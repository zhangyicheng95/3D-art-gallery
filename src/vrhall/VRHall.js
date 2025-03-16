import * as THREE from "three";
import CameraControls from "camera-controls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { Reflector } from "./Reflector";
import offset from "offset";
import Gravity from "./Gravity";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import KeyboardControls from "./KeyboardControls";

CameraControls.install({ THREE: THREE });

export class VRHall {
  /**
   * 外部传入的配置
   */
  _options = {
    debugger: false, // 开启调试模式
    maxSize: 20, // 画框的尺寸
    // 移动高度
    movieHight: 2,
    // 容器
    container: document.body,
    // 点击元素回调函数
    onClick: null,
    // 相机配置
    cameraOption: {
      position: { x: 0, y: 2, z: 0 },
      lookAt: { x: 2, y: 2, z: 2 },
    },
    // 键盘控制配置
    keyboardControls: {
      enabled: true,  // 默认开启键盘控制
      moveSpeed: 3.0, // 移动速度
    },
  };

  // 默认尺寸
  _size = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // 渲染器
  _renderer = null;
  // 相机
  _camera = null;
  // 场景
  _scene = null;
  // 时钟
  _clock = new THREE.Clock();
  // 控制器
  _controls = null;
  // 动画实例
  _requestAnimate = null;
  // 相机和视点的距离
  _EPS = 1e-5;
  // gltf加载器
  _gltfLoader = new GLTFLoader();
  // 屏幕射线
  _raycaster = new THREE.Raycaster();
  // 展厅模型
  _hallMesh = null;
  // 展厅地板名称
  _hallPlaneName = "plane";
  _planeMesh = null;
  // 加载器
  _textLoader = new THREE.TextureLoader();
  // 事件元素
  _eventMeshs = [];
  // 控制器
  _transfromControls = null;

  // 事件
  _events = {};

  // 展品数据
  _itemsData = [];

  // 动画
  _animates = [];

  // 重力感应实例
  gravity = null;
  
  // 键盘控制器
  _keyboardControls = null;
  
  // 保存的truck速度
  _savedTruckSpeed = undefined;
  
  // 碰撞对象列表
  collisionObjects = [];

  constructor(options) {
    Object.assign(this._options, options);
    this._size.width = this._options.container.clientWidth;
    this._size.height = this._options.container.clientHeight;
    this._init();
    this._bindEvent();
    this._lookat().then(() => {
      if (this._options.callback) {
        this._options.callback();
      }
    });
    this._animate();
    window.addEventListener("resize", this._resize.bind(this));
    // 调试用
    if (this._options.debugger) {
      this._initTransformControls();
      this._scene.add(new THREE.AxesHelper(1000));
    }
    this.gravity = new Gravity(this._controls);
    
    // 初始化键盘控制
    if (this._options.keyboardControls && this._options.keyboardControls.enabled) {
      this._keyboardControls = new KeyboardControls(this._camera, this._controls, this._renderer.domElement);
      
      // 设置移动速度
      if (this._options.keyboardControls.moveSpeed) {
        this._keyboardControls.moveSpeed = this._options.keyboardControls.moveSpeed;
      }
      
      // 启用键盘控制
      this._keyboardControls.enable();
      
      // 保存原始的truck速度，以便在切换控制器时恢复
      this._savedTruckSpeed = this._controls.truckSpeed;
      
      if (this._options.debugger) {
        console.log('键盘控制初始化完成, 移动速度:', this._keyboardControls.moveSpeed);
      }
    }
  }

  initVRButton = (target = document.body) => {
    this._renderer.xr.enabled = true;
    this._renderer.xr.setReferenceSpaceType("local");
    target.appendChild(VRButton.createButton(this._renderer));

    // this.train = new THREE.Object3D();
    // this.train.add(this._camera);
    // this._scene.add(this.train);

    // // VR
    // this.controllervr1 = this._renderer.xr.getController(0);
    // this.controllervr1.addEventListener("selectstart", this.onVRSelectStart);
    // this.train.add(this.controllervr1);

    // this.controllervr2 = this._renderer.xr.getController(1);
    // this.controllervr2.addEventListener("selectstart", this.onVRSelectStart);
    // this.train.add(this.controllervr2);

    // const geometry = new THREE.BufferGeometry().setFromPoints([
    //   new THREE.Vector3(0, 0, 0),
    //   new THREE.Vector3(0, 0, -1),
    // ]);
    // const line = new THREE.Line(geometry);
    // line.name = "line";
    // line.scale.z = 5;
    // this.controllervr1.add(line.clone());
    // this.controllervr2.add(line.clone());

    //     setTimeout(() => {
    //       // 初始位置
    //       const { position, lookAt } = this._options.cameraOption;
    //       this._camera.position.set(position.x, position.y, position.z);
    //       this._camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
    //     }, 1000);
  };

  addAnimate(afun) {
    this._animates.push(afun);
  }

  // 加入到可点击元素
  addClickEvent(mesh) {
    this._eventMeshs.push(mesh);
  }

  // 镜面反射
  _reflectorPlane() {
    const size = 1000;
    // 镜面
    const geometry = new THREE.PlaneBufferGeometry(size, size);
    const verticalMirror = new Reflector(geometry, {
      opacity: 0.1,
      textureWidth: size,
      textureHeight: size,
      color: "#fff",
    });
    verticalMirror.material.side = THREE.DoubleSide;
    verticalMirror.material.transparent = true;
    verticalMirror.material.opacity = 0.1;
    verticalMirror.rotation.x = -Math.PI / 2;
    verticalMirror.position.y = this._planeMesh.position.y + 0.1;
    this._scene.add(verticalMirror);
  }

  /**
   * 初始化
   */
  _init() {
    // 初始化渲染器
    this._renderer = new THREE.WebGLRenderer({
      antialias: true, // 抗锯齿
      alpha: true,
      transparent: true,
      logarithmicDepthBuffer: true, // 解决部分Z-Fighting问题，会消耗性能, 安卓开启
      precision: 'highp', // 高精度渲染
      powerPreference: 'high-performance' // 优先使用高性能GPU
    });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.sortObjects = true;
    this._renderer.outputEncoding = THREE.sRGBEncoding; // 使用sRGB编码提高颜色准确性
    this._renderer.setClearColor(0x000000, 0); // 设置透明背景色
    this._renderer.setSize(this._size.width, this._size.height);
    this._renderer.shadowMap.enabled = true; // 开启阴影
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 使用PCF软阴影
    
    this._options.container.innerHTML = "";
    this._options.container.appendChild(this._renderer.domElement);

    const { width, height } = this._size;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x000000); // 设置黑色背景

    // 相机
    this._camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 10000);
    this._scene.add(this._camera);

    // 光
    this._scene.add(new THREE.AmbientLight(0xffffff, 1));
    // 平行光
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(5, 5, 5);
    dirLight.castShadow = true; // 启用阴影投射
    // 配置阴影属性
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.001; // 减少阴影痤疮
    this._scene.add(dirLight);

    // 控制器，第一人称视角
    this._controls = new CameraControls(
      this._camera,
      this._renderer.domElement
    );
    this._controls.maxDistance = this._EPS;
    this._controls.minZoom = 0.5;
    this._controls.maxZoom = 5;
    this._controls.dragToOffset = false;
    this._controls.distance = 1;
    this._controls.dampingFactor = 0.01; // 阻尼运动
    this._controls.truckSpeed = 0.01; // 拖动速度
    this._controls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
    this._controls.mouseButtons.right = CameraControls.ACTION.NONE;
    this._controls.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
    this._controls.touches.three = CameraControls.ACTION.NONE;

    // 逆向控制
    this._controls.azimuthRotateSpeed = -0.5; // 方位角旋转速度。
    this._controls.polarRotateSpeed = -0.5; // 极旋转的速度。
    this._controls.saveState();
  }

  // 初始调试用的变换控制器
  _initTransformControls() {
    // 变换控制器
    this._transformControls = new TransformControls(
      this._camera,
      this._renderer.domElement
    );

    this._transformControls.setSpace("local"); // 本地坐标

    // 操作变换控制器时, 停止相机控制器
    this._transformControls.addEventListener("mouseDown", () => {
      this._controls.enabled = false;
    });

    // 停止变换控制器时, 恢复相机控制器
    this._transformControls.addEventListener("mouseUp", () => {
      this._controls.enabled = true;
    });

    // 变换控制改变时打印位置信息
    this._transformControls.addEventListener("objectChange", (e) => {
      const { position, scale, rotation } = this._transformControls.object;
      console.log(
        `position:{x:${position.x},y:${position.y},z:${position.z}},scale:{x:${scale.x},y:${scale.y},z:${scale.z}},rotation:{x:${rotation.x},y:${rotation.y},z:${rotation.z}}`
      );
    });

    // q 移动 w旋转 e缩放
    window.addEventListener("keydown", (e) => {
      e.key === "q" && this._transformControls.setMode("translate");
      e.key === "w" && this._transformControls.setMode("rotate");
      e.key === "e" && this._transformControls.setMode("scale");
    });

    this._scene.add(this._transformControls);
  }

  /**
   * 重新设置大小
   */
  _resize() {
    this._size.width = this._options.container.clientWidth;
    this._size.height = this._options.container.clientHeight;
    this._renderer.setSize(this._size.width, this._size.height);
    // 更新相机的宽高比
    this._camera.aspect = this._size.width / this._size.height;
    this._camera.updateProjectionMatrix();
  }

  createAnimate(
    gltf,
    { animateIndex, duration } = { animateIndex: 0, duration: 10 }
  ) {
    // 调用动画
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const ani = gltf.animations[animateIndex];
    const AnimationAction = mixer.clipAction(ani);
    AnimationAction.setDuration(duration).play();
    mixer.update(0);
    // 加入动画
    this.addAnimate((d) => {
      mixer.update(d);
    });

    return mixer;
  }

  // 查看作品
  viewItem(id) {
    const item = this._itemsData.find((d) => d.id === id);
    if (item) {
      this.moveTo(item.view, item.position);
    } else {
      console.error("id不存在", id);
    }
  }

  /**
   * 移动动画
   * @param {*} to
   * @param {*} lookat
   * @param {*} duration
   */
  moveTo(position, lookat, duration) {
    this._controls.saveState();
    const lookatV3 = new THREE.Vector3(position.x, position.y, position.z);
    lookatV3.lerp(new THREE.Vector3(lookat.x, lookat.y, lookat.z), this._EPS);

    // 获取当前的lookAt参数
    const fromPosition = new THREE.Vector3();
    const fromLookAt = new THREE.Vector3();
    this._controls.getPosition(fromPosition);
    this._controls.getTarget(fromLookAt);

    const lookatV32 = new THREE.Vector3(position.x, position.y, position.z);
    lookatV32.lerp(new THREE.Vector3(lookat.x, lookat.y, lookat.z), this._EPS);

    this._controls.setLookAt(
      position.x,
      position.y,
      position.z,
      lookatV3.x,
      lookatV3.y,
      lookatV3.z,
      true
    );
  }

  _findParentOdata(mesh) {
    if (mesh.odata) {
      console.log(mesh);
      return mesh;
    } else {
      if (mesh.parent) {
        return this._findParentOdata.bind(this)(mesh.parent);
      } else {
        return null;
      }
    }
  }

  /**
   * 传入坐标，返回当前的raycaster屏幕坐标
   * x, y 是画布相对坐标
   */
  _getBoxRaycaster({ x, y }, meshes) {
    // 射线计算
    const container = this._options.container;
    this._mouse = new THREE.Vector2();
    this._mouse.set(
      (x / container.clientWidth) * 2 - 1,
      -(y / container.clientHeight) * 2 + 1
    );
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersects = this._raycaster.intersectObjects(
      [...meshes, ...this._eventMeshs],
      true
    );
    const intersect = intersects[0];
    if (intersect) {
      const v3 = intersects[0].point;
      const lookat = this._camera.position.lerp(v3, 1 + this._EPS);
      // 点击元素
      const mesh = intersect.object;

      // 因为被点击的元素可能是子元素，所以要溯源，找到父元素的odata
      const odataMesh = this._findParentOdata(mesh);

      // 如果点击的是画框，初始化控制器
      if (this._options.debugger && odataMesh && this._transformControls) {
        this._transformControls.attach(odataMesh);
      }

      // 元素点击事件
      if (odataMesh && this._options.onClick) {
        this._options.onClick(odataMesh.odata);
      }

      return { position: v3, lookat, mesh };
    } else {
      console.log("点击空气？");
    }

    return false;
  }

  /**
   * 初始化视角
   * @returns
   */
  async _lookat() {
    if (!this._options.cameraOption) {
      return;
    }
    const { position, lookAt } = this._options.cameraOption;
    const lookatV3 = new THREE.Vector3(position.x, position.y, position.z);
    lookatV3.lerp(new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z), this._EPS);
    this._controls.zoomTo(0.8);
    await this._controls.setLookAt(
      position.x,
      position.y,
      position.z,
      lookatV3.x,
      lookatV3.y,
      lookatV3.z,
      false
    );
  }

  /**
   * 动画
   */
  _animate() {
    const delta = this._clock.getDelta();
    if (this._controls) {
      this._controls.update(delta);
    }
    
    // 更新键盘控制
    if (this._keyboardControls && this._keyboardControls.enabled) {
      this._keyboardControls.update(delta);
    }
    
    if (this._renderer) {
      this._renderer.render(this._scene, this._camera);
    }

    if (this._animates) {
      this._animates.forEach((afun) => {
        afun(delta);
      });
    }

    this._requestAnimate = requestAnimationFrame(this._animate.bind(this));
  }

  _mouseDown(event) {
    this._events.startXY = { x: event.clientX, y: event.clientY };
  }

  _mouseUp(event) {
    // x, y 偏移
    const { top, left } = offset(this._options.container);
    const { x, y } = this._events.startXY;
    const offsetPoor = 2;

    // 判断是否点击事件，如果偏移量小于2就是点击事件
    if (
      Math.abs(event.clientX - x) > offsetPoor ||
      Math.abs(event.clientY - y) > offsetPoor
    ) {
      return;
    }

    const rayRes = this._getBoxRaycaster(
      {
        x: event.clientX - left,
        y: event.clientY - top,
      },
      [this._hallMesh]
    );

    if (rayRes) {
      const { position, lookat, mesh } = rayRes;
      // 点击地面移动
      console.log("rayRes", mesh, rayRes, position, {
        x: event.clientX - left,
        y: event.clientY - top,
      });
      if (mesh.name === this._hallPlaneName) {
        // 移动
        this.moveTo(
          { x: position.x, y: this._options.movieHight, z: position.z },
          { x: lookat.x, y: this._options.movieHight, z: lookat.z },
          3
        );
      }
    }
  }

  /**
   * 事件绑定
   */
  _bindEvent() {
    this._options.container.addEventListener(
      "mousedown",
      this._mouseDown.bind(this)
    );
    this._options.container.addEventListener(
      "mouseup",
      this._mouseUp.bind(this)
    );
  }

  /**
   * 加载模型
   * url 模型URL
   * position 模型摆放位置
   * rotation 模型旋转角度
   * scale 模型缩放大小
   * onProgress 模型加载进度 progress => void;
   * callback 回调函数 mesh => void;
   * animate 动画函数 () => void;
   * @param {*} url
   */
  loadGLTF(params) {
    return new Promise((resolve) => {
      const {
        url,
        position,
        scale = 1,
        rotation,
        onProgress,
        animate,
        autoLight, // 自动增亮
      } = params;
      this._gltfLoader.load(
        url,
        (gltf) => {
          const mesh = gltf.scene;
          const box = new THREE.Box3()
            .setFromObject(mesh)
            .getSize(new THREE.Vector3());
          console.log("box模型大小", url, box, mesh);

          if (autoLight) {
            gltf.scene.traverse((child) => {
              if (child.isMesh) {
                // child.frustumCulled = false;
                //模型阴影，开启阴影比较消耗性能
                child.castShadow = true;
                //模型自发光
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
              }
            });
          }

          mesh.scale.set(scale, scale, scale);
          if (position) {
            mesh.position.y = position.y;
            mesh.position.x = position.x;
            mesh.position.z = position.z;
          }
          if (rotation) {
            mesh.rotation.y = rotation.y;
            mesh.rotation.x = rotation.x;
            mesh.rotation.z = rotation.z;
          }
          this._scene.add(mesh);
          if (animate) {
            mesh.animations = animate;
          }
          resolve(gltf);
        },
        (progress) => {
          if (onProgress) {
            onProgress(progress);
          }
        },
        (err) => {
          console.error(err);
        }
      );
    });
  }

  /**
   * 载入展厅模型
   * url 模型URL
   * planeName 地板名称
   * position 模型摆放位置
   * rotation 模型旋转角度
   * scale 模型缩放大小
   * onProgress 模型加载进度
   * callback 回调函数
   */
  async loadHall(params) {
    this._hallPlaneName = params.planeName;
    return await this.loadGLTF({ ...params }).then((gltf) => {
      this._hallMesh = gltf.scene;
      gltf.scene.traverse((mesh) => {
        if (mesh.name === params.planeName) {
          this._planeMesh = mesh;
        }
      });
      
      // 在模型加载完成后设置碰撞检测对象
      if (this._options.keyboardControls && this._options.keyboardControls.enabled) {
        this._setupCollisionObjects();
      }
      
      return gltf;
    });
  }

  /**
   * 载入展品数据
   */
  loadItems(data) {
    this._itemsData = data;
    const { maxSize } = this._options;
    data.forEach(async (item) => {
      const texture = await this._textLoader.loadAsync(item.url);
      if (texture.image.width > maxSize) {
        item.width = maxSize;
        item.height = (maxSize / texture.image.width) * texture.image.height;
      } else {
        item.height = MAX;
        item.width = (maxSize / texture.image.height) * texture.image.width;
      }

      const geometry = new THREE.BoxGeometry(
        item.width,
        item.height,
        item.depth ? item.depth : 2
      );
      const materialBorder = new THREE.MeshBasicMaterial({
        color: item.color ? item.color : "#ffffff",
        map: this._textLoader.load("./assets/room1/wall.png"),
      });
      const material = new THREE.MeshBasicMaterial({
        color: item.color ? item.color : "#ffffff",
        map: texture,
      });
      const cube = new THREE.Mesh(geometry, [
        materialBorder,
        materialBorder,
        materialBorder,
        materialBorder,
        materialBorder,
        material,
      ]);
      cube.name = item.name;
      cube.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
      cube.scale.set(item.scale.x, item.scale.y, item.scale.z);
      cube.position.set(item.position.x, item.position.y, item.position.z);
      cube.odata = item;
      this._scene.add(cube);
      this._eventMeshs.push(cube);
    });
  }

  /**
   * 销毁
   */
  destroy() {
    this._options.container.removeEventListener(
      "mousedown",
      this._mouseDown.bind(this)
    );
    this._options.container.removeEventListener(
      "mouseup",
      this._mouseUp.bind(this)
    );
    window.removeEventListener("resize", this._resize.bind(this));

    // 重力感应实例
    this.gravity = null;
    this.gravity.destroy();
    
    // 销毁键盘控制
    if (this._keyboardControls) {
      this._keyboardControls.dispose();
      this._keyboardControls = null;
    }

    this._renderer.dispose();

    this._options = null;
    // 渲染器
    this._renderer = null;
    // 相机
    this._camera = null;
    // 场景
    this._scene = null;
    // 时钟
    this._clock = null;
    // 控制器
    this._controls = null;
    // 动画实例
    cancelAnimationFrame(this._requestAnimate);
    this._requestAnimate = null;
    // gltf加载器
    this._gltfLoader = null;
    // 屏幕射线
    this._raycaster = null;
    // 展厅模型
    this._hallMesh = null;
    // 展厅地板名称
    this._planeMesh = null;
    // 加载器
    this._textLoader = null;
    // 事件元素
    this._eventMeshs = null;
    // 控制器
    this._transfromControls = null;

    // 事件
    this._events = null;

    // 展品数据
    this._itemsData = null;

    // 动画
    this._animates = null;
  }

  /**
   * 切换键盘控制
   * @param {boolean} enabled - 是否启用
   * @param {number} speed - 移动速度
   */
  toggleKeyboardControls(enabled, speed) {
    if (!this._keyboardControls) {
      if (enabled) {
        // 如果需要启用但尚未初始化，创建新的实例
        this._keyboardControls = new KeyboardControls(this._camera, this._controls, this._renderer.domElement);
        
        // 保存原始的truck速度
        if (this._savedTruckSpeed === undefined) {
          this._savedTruckSpeed = this._controls.truckSpeed;
        }
        
        // 设置移动速度
        if (speed !== undefined) {
          this._keyboardControls.moveSpeed = speed;
        }
        
        // 设置碰撞对象
        if (this.collisionObjects && this.collisionObjects.length > 0) {
          this._keyboardControls.setCollisionObjects(this.collisionObjects);
        }
        
        // 启用键盘控制
        this._keyboardControls.enable();
        
        console.log('键盘控制已启用');
      }
      return;
    }
    
    if (enabled) {
      // 如果已存在实例，直接启用
      this._keyboardControls.enable();
      
      // 更新移动速度
      if (speed !== undefined) {
        this._keyboardControls.moveSpeed = speed;
      }
      
      // 减慢camera-controls的移动速度，以避免冲突
      if (this._savedTruckSpeed !== undefined) {
        this._controls.truckSpeed = 0.0001; // 设为极小值但不为0
      }
      
      console.log('键盘控制已启用');
    } else {
      // 禁用键盘控制
      this._keyboardControls.disable();
      
      // 恢复camera-controls的移动速度
      if (this._savedTruckSpeed !== undefined) {
        this._controls.truckSpeed = this._savedTruckSpeed;
      }
      
      console.log('键盘控制已禁用');
    }
  }

  /**
   * 设置碰撞对象
   * @private
   */
  _setupCollisionObjects() {
    this.collisionObjects = [];
    
    // 收集所有展台对象
    const exhibitStands = [];
    
    // 遍历场馆网格查找墙壁和其他碰撞对象
    if (this._hallMesh) {
      this._hallMesh.traverse(object => {
        // 检查对象是否可以用于碰撞检测
        if (object.isMesh) {
          // 墙壁和地板通常包含这些关键字
          const isWallOrFloor = object.name && (
            object.name.toLowerCase().includes('wall') || 
            object.name.toLowerCase().includes('floor') || 
            object.name.toLowerCase().includes('ceiling') || 
            object.name.toLowerCase().includes('roof') ||
            object.name.toLowerCase().includes('qiang') || // 墙
            object.name.toLowerCase().includes('di') ||    // 地
            object.name.toLowerCase().includes('ding')     // 顶
          );
          
          // 展台通常包含这些关键字
          const isExhibitStand = object.name && (
            object.name.toLowerCase().includes('dizuo') || 
            object.name.toLowerCase().includes('zhuotai') || 
            object.name.toLowerCase().includes('table') || 
            object.name.toLowerCase().includes('desk') ||
            object.name.toLowerCase().includes('stand') ||
            object.name.toLowerCase().includes('platform') ||
            object.name.toLowerCase().includes('tai') ||
            object.name.toLowerCase().includes('zhuo')
          );
          
          if (isExhibitStand) {
            if (this._options.debugger) {
              console.log('发现展台:', object.name);
            }
            object.isExhibitStand = true;
            exhibitStands.push(object);
          }
          
          // 标记墙壁和天花板，用于特殊处理
          if (isWallOrFloor) {
            object.isWallOrFloor = true;
            
            // 判断是否是天花板
            const isCeiling = object.name.toLowerCase().includes('ceiling') || 
                             object.name.toLowerCase().includes('roof') ||
                             object.name.toLowerCase().includes('ding');
                             
            if (isCeiling) {
              object.isCeiling = true;
              if (this._options.debugger) {
                console.log('发现天花板:', object.name);
              }
            }
          }
          
          // 添加所有网格到碰撞对象列表
          this.collisionObjects.push(object);
        }
      });
      
      // 为所有展台创建额外的碰撞盒
      for (const stand of exhibitStands) {
        const collisionBox = this._createPreciseCollisionBox(stand);
        this._scene.add(collisionBox);
        this.collisionObjects.push(collisionBox);
        
        // 如果是平展台(高度较小)，创建一个更大的碰撞盒
        const boundingBox = new THREE.Box3().setFromObject(stand);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        if (size.y < 0.5) { // 小于0.5米的展台，认为是平展台
          // 创建一个高一点的碰撞盒，防止穿过展台
          const tallGeometry = new THREE.BoxGeometry(size.x * 1.1, 1.0, size.z * 1.1);
          const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.0  // 始终设置为完全透明，避免在非调试模式下显示
          });
          
          const tallCollider = new THREE.Mesh(tallGeometry, material);
          
          // 获取中心点，但Y坐标要调整，使碰撞盒底部与展台底部对齐
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          center.y = boundingBox.min.y + (1.0 / 2); // 将中心点设置为底部+半高
          
          tallCollider.position.copy(center);
          tallCollider.isCollider = true;
          tallCollider.isExhibitStand = true;
          tallCollider.name = stand.name + "_tall_collider";
          
          // 设置为不可见，只用于碰撞检测
          tallCollider.visible = this._options.debugger;
          
          this._scene.add(tallCollider);
          this.collisionObjects.push(tallCollider);
          
          if (this._options.debugger) {
            console.log('为平展台创建高碰撞盒:', stand.name, '原始高度:', size.y);
          }
        }
      }
      
      // 为墙壁和天花板添加视角碰撞盒，防止视角穿模
      const viewColliders = [];
      
      this.collisionObjects.forEach(object => {
        if (object.isWallOrFloor) {
          // 获取物体的边界盒
          const boundingBox = new THREE.Box3().setFromObject(object);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          
          // 只为较大的墙壁和天花板创建视角碰撞器
          const isLarge = size.x > 1.0 || size.z > 1.0;
          
          if (isLarge) {
            // 创建略小的碰撞盒，专门用于视角碰撞检测
            const viewGeometry = new THREE.BoxGeometry(
              Math.max(0.1, size.x * 0.98), 
              Math.max(0.1, size.y * 0.98), 
              Math.max(0.1, size.z * 0.98)
            );
            
            const viewMaterial = new THREE.MeshBasicMaterial({
              color: object.isCeiling ? 0x0000ff : 0xff0000,
              transparent: true,
              opacity: 0.0  // 始终设置为完全透明，避免在非调试模式下显示
            });
            
            const viewCollider = new THREE.Mesh(viewGeometry, viewMaterial);
            
            // 设置位置
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);
            viewCollider.position.copy(center);
            
            // 特殊标记
            viewCollider.isViewCollider = true;
            viewCollider.name = object.name + "_view_collider";
            viewCollider.isWallOrFloor = true;
            if (object.isCeiling) {
              viewCollider.isCeiling = true;
            }
            
            // 设置为不可见，只用于碰撞检测
            viewCollider.visible = this._options.debugger;
            
            viewColliders.push(viewCollider);
            
            if (this._options.debugger) {
              console.log('为墙壁/天花板创建视角碰撞盒:', object.name);
            }
          }
        }
      });
      
      // 将视角碰撞器添加到场景和碰撞对象列表
      viewColliders.forEach(collider => {
        this._scene.add(collider);
        this.collisionObjects.push(collider);
      });
    }
    
    if (this._options.debugger) {
      console.log('设置完成碰撞对象, 总数:', this.collisionObjects.length);
    }
    
    // 初始化键盘控制
    if (this._keyboardControls) {
      this._keyboardControls.setCollisionObjects(this.collisionObjects);
    }
  }
  
  /**
   * 为展台创建更精确的碰撞盒。
   * @param {THREE.Object3D} object - 目标展台对象
   * @private
   */
  _createPreciseCollisionBox(object) {
    // 先获取对象的边界盒子
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // 计算盒子的尺寸
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // 获取中心点
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    // 为了更好的碰撞检测，我们扩大尺寸（所有方向都扩大）
    const expandedWidth = size.x * 1.05;  // 宽度扩大5%
    const expandedHeight = size.y * 1.1;  // 高度扩大10%
    const expandedDepth = size.z * 1.05;  // 深度扩大5%
    
    // 创建更大的碰撞盒几何体
    const geometry = new THREE.BoxGeometry(expandedWidth, expandedHeight, expandedDepth);
    
    // 创建透明材质
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.0,  // 始终设置为完全透明，避免在非调试模式下显示
    });
    
    // 创建碰撞网格
    const collisionMesh = new THREE.Mesh(geometry, material);
    
    // 设置碰撞网格的位置 (使用原对象的中心点)
    collisionMesh.position.copy(center);
    
    // 标记为碰撞对象
    collisionMesh.isCollider = true;
    collisionMesh.isExhibitStand = true;
    collisionMesh.name = object.name + "_collider";
    
    // 设置为不可见，只用于碰撞检测
    collisionMesh.visible = this._options.debugger;
    
    // 添加额外的辅助属性，帮助碰撞检测
    collisionMesh.userData = {
      isExhibitStand: true,
      originalObject: object.name,
      isPreciseCollider: true
    };
    
    if (this._options.debugger) {
      console.log('为展台创建碰撞盒:', object.name, '原始尺寸:', size, '扩展尺寸:', expandedWidth, expandedHeight, expandedDepth);
    }
    
    return collisionMesh;
  }
}
