import "./index.less";
import * as THREE from "three";
import VRHall from "./vrhall";
// import VRHall from "./lib/vrhall.es";
import { data } from "./pictures2";
import Zoomtastic from "zoomtastic";
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

// 因为模型所需，正常的gltf模型是不需要手动设置贴图的，这里是网上找的模型
import * as m from "./materls";

window.onload = function () {
  // 添加按键操作说明
  console.log(
    '键盘控制说明：\n' +
    'W: 向前移动\n' +
    'S: 向后移动\n' +
    'A: 向左移动\n' +
    'D: 向右移动\n' +
    'Space: 向上移动\n' +
    'Shift: 向下移动\n' +
    '鼠标左键: 视角旋转'
  );

  console.log('优化已完成，如遇白色色块问题，请刷新页面');

  // 实例化
  const vr = new VRHall({
    debugger: false, // 关闭调试模式
    maxSize: 20, // 画框最大尺寸
    movieHight: 2, // 移动的高度
    container: document.getElementById("root"),
    cameraOption: {
      position: { x: 26.928, y: 3, z: 0 },
      lookAt: { x: 20, y: 0.6, z: 0 },
    },
    keyboardControls: {
      enabled: true,  // 默认开启键盘控制
      moveSpeed: 3.0, // 将默认速度设置为 3.0
    },
    onClick: (item) => {
      console.log("你点击了", item);
      if (item.url) {
        Zoomtastic.show(item.url);
      }
      // alert(JSON.stringify(item, null, 2));
    },
  });

  // 创建展品信息显示元素
  const tourInfo = document.createElement("div");
  tourInfo.className = "tour-info";
  tourInfo.style.display = "none";
  document.body.appendChild(tourInfo);
  
  function showTourInfo(name) {
    tourInfo.textContent = `正在观赏: ${name}`;
    tourInfo.style.display = "block";
  }
  
  function hideTourInfo() {
    tourInfo.style.display = "none";
  }

  Zoomtastic.mount();

  // 加载厅模型
  vr.loadHall({
    url: "./assets/room2/dm.glb",
    planeName: "dm", // plane , meishu01
    // position: { x: 2, y: -0.2, z: 2 },
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    onProgress: (p) => {
      console.log("加载进度", p);
    },
  }).then((gltf) => {
    // 正常gltf模型无需设置这些参数，因为网上找的模型，直接拷贝过来的代码
    gltf.scene.traverse(function (child) {
      if (child.isMesh) {
        // 为所有名称中包含qiang(墙)和men(门)的网格添加墙壁标记
        if (child.name.includes('qiang') ||
          child.name.includes('men') ||
          child.name.includes('wall')) {
          // 标记为墙壁，用于碰撞检测
          child.isWallOrFloor = true;
          child.isWall = true;
          console.log('标记墙壁:', child.name);

          // 增强墙壁的碰撞检测体积
          if (child.geometry) {
            // 记录原始几何体的范围
            child.geometry.computeBoundingBox();
            const originalBox = child.geometry.boundingBox.clone();

            // 计算法线方向的墙壁厚度扩展
            // 向内增加墙壁厚度，避免穿墙
            const thicknessIncrease = 0.2; // 增加20cm厚度

            // 创建隐形的碰撞墙
            const boundingBoxGeometry = new THREE.BoxGeometry(
              originalBox.max.x - originalBox.min.x + thicknessIncrease,
              originalBox.max.y - originalBox.min.y,
              originalBox.max.z - originalBox.min.z + thicknessIncrease
            );

            // 创建一个透明材质
            const collisionMaterial = new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: 0.0, // 完全不可见
              depthWrite: false, // 不写入深度缓冲区
              side: THREE.DoubleSide
            });

            // 创建碰撞网格
            const collisionMesh = new THREE.Mesh(boundingBoxGeometry, collisionMaterial);
            collisionMesh.name = `${child.name}_collision`;
            collisionMesh.isWallOrFloor = true; // 标记为墙壁
            collisionMesh.isWall = true; // 标记为墙壁
            collisionMesh.isCollisionHelper = true; // 标记为碰撞辅助体

            // 复制变换
            collisionMesh.position.copy(child.position);
            collisionMesh.rotation.copy(child.rotation);
            collisionMesh.scale.copy(child.scale);

            // 添加到场景
            vr._scene.add(collisionMesh);
            console.log('为墙壁创建碰撞辅助体:', collisionMesh.name);
          }
        }

        // 为所有名称中包含ding(顶)的网格添加天花板标记
        if (child.name.includes('ding') ||
          child.name.includes('ceil')) {
          child.isWallOrFloor = true;
          child.isCeiling = true;
          console.log('标记天花板:', child.name);
        }

        // 为所有名称中包含dimian(地面)的网格添加地面标记
        if (child.name.includes('dimian') ||
          child.name.includes('floor') ||
          child.name.includes('ground') ||
          child.name.includes('di')) {
          child.isWallOrFloor = true;
          child.isFloor = true;
          console.log('标记地面:', child.name);
        }
      }

      // if (child.material) {
      //   child.material.emissiveMap = child.material.map;
      // }
    });

    const dm_OBJ = gltf.scene.getObjectByName("dm");
    dm_OBJ.material = m.dm_M;
    const dm2_OBJ = gltf.scene.getObjectByName("dm2");
    dm2_OBJ.material = m.wall_M;
    const qiang5_OBJ = gltf.scene.getObjectByName("qiang5");
    qiang5_OBJ.material = m.qiang5_M;
    const huaqiang1_OBJ = gltf.scene.getObjectByName("huaqiang1");
    huaqiang1_OBJ.material = m.huaqiang1_M;
    const huaqiang3_OBJ = gltf.scene.getObjectByName("huaqiang3");
    huaqiang3_OBJ.material = m.huaqiang3_M;
    const huaqiang2_OBJ = gltf.scene.getObjectByName("huaqiang2");
    huaqiang2_OBJ.material = m.huaqiang2_M;
    const qiang2_OBJ = gltf.scene.getObjectByName("qiang2");
    qiang2_OBJ.material = m.qiang2_M;
    const qiang3_OBJ = gltf.scene.getObjectByName("qiang3");
    qiang3_OBJ.material = m.qiang3_M;
    const qiang1_OBJ = gltf.scene.getObjectByName("qiang1");
    qiang1_OBJ.material = m.qiang1_M;
    const men2_OBJ = gltf.scene.getObjectByName("men2");
    men2_OBJ.material = m.men2_M;
    const chuanghu_OBJ = gltf.scene.getObjectByName("chuanghu");
    chuanghu_OBJ.material = m.chuanghu_M;
    const dingtiao_OBJ = gltf.scene.getObjectByName("dingtiao");
    dingtiao_OBJ.material = m.dingtiao_M;
    const dingbian_OBJ = gltf.scene.getObjectByName("dingbian");
    dingbian_OBJ.material = m.dingbian_M;
    const dizuo1_OBJ = gltf.scene.getObjectByName("dizuo1");
    dizuo1_OBJ.material = m.dizuo1_M;
    const qiang4_OBJ = gltf.scene.getObjectByName("qiang4");
    qiang4_OBJ.material = m.qiang4_M;
    const cebaiqiang_OBJ = gltf.scene.getObjectByName("cebaiqiang");
    cebaiqiang_OBJ.material = m.ding_M;
    const boli1_OBJ = gltf.scene.getObjectByName("boli1");
    boli1_OBJ.material = m.boli1_M;
    const dimian2_OBJ = gltf.scene.getObjectByName("dimian2");
    dimian2_OBJ.material = m.dimian2_M;
    const dimian3_OBJ = gltf.scene.getObjectByName("dimian3");
    dimian3_OBJ.material = m.dimian3_M;
    const deng_OBJ = gltf.scene.getObjectByName("deng");
    deng_OBJ.material = m.deng_M;
    const ding_OBJ = gltf.scene.getObjectByName("ding");
    ding_OBJ.material = m.ding_M;
    const baiding_OBJ = gltf.scene.getObjectByName("baiding");
    baiding_OBJ.material = m.baiding_M;

    // 自定义info
    const info3d = gltf.scene.getObjectByName("jianjieqiang");
    info3d.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: new THREE.TextureLoader().load("./assets/pictures2/main.jpg"),
      // depthFunc: 3,
    });
  });

  // 加载机器人
  vr.loadGLTF({
    url: "./assets/robot/robot.glb",
    position: {
      x: 19.655541400079763,
      y: 0.3955837972716467,
      z: 3.3849787954383963,
    },
    // autoLight: true,
    rotation: { x: 0, y: -Math.PI / 2, z: 0 },
    scale: 0.4,
  }).then((gltf) => {
    gltf.scene.odata = { id: "robot" };
    vr.addClickEvent(gltf.scene);
    // 调用动画
    vr.createAnimate(gltf, { animateIndex: 0, duration: 5 });
  });

  // 加载球模型
  vr.loadGLTF({
    scale: 0.5,
    position: {
      x: 0.14009586306492472,
      y: 0.3955837972716467,
      z: 3.3849787954383963,
    },
    autoLight: true,
    url: `./assets/separate/sphere-bot-with-hydraulics_2_8_Baked_Animations.gltf`,
  }).then((gltf) => {
    gltf.scene.odata = { id: "ball" };
    vr.addClickEvent(gltf.scene);
    // 调用动画
    vr.createAnimate(gltf, { animateIndex: 0, duration: 60 });
  });

  // // 加载房模型
  vr.loadGLTF({
    scale: 0.4,
    position: {
      x: -9.697628171904498,
      y: 1.6742415555214554,
      z: 3.343388656678843,
    },
    rotation: {
      x: -3.141592653589793,
      y: 0.03132610956215899,
      z: -3.141592653589793,
    },
    url: `./assets/gltfs/feichuan.glb`,
    autoLight: true,
  }).then((gltf) => {
    gltf.scene.odata = { id: "man" };
    vr.addClickEvent(gltf.scene);
    vr.createAnimate(gltf, { animateIndex: 0, duration: 10 });
  });

  // 加载画框数据
  vr.loadItems(data);

  // 添加两个白色立方体展台
  // 创建第一个展台 - 大理石纹理
  const cubeGeometry1 = new THREE.BoxGeometry(1, 3, 1);
  
  // 创建大理石纹理的Canvas
  const marbleCanvas = document.createElement('canvas');
  marbleCanvas.width = 512;
  marbleCanvas.height = 512;
  const marbleCtx = marbleCanvas.getContext('2d');
  
  // 填充白色背景
  marbleCtx.fillStyle = '#f0f0f0';
  marbleCtx.fillRect(0, 0, marbleCanvas.width, marbleCanvas.height);
  
  // 绘制大理石纹理
  for (let i = 0; i < 40; i++) {
    const length = Math.random() * 100 + 50;
    const thickness = Math.random() * 3 + 1;
    const curve = Math.random() * 30 + 10;
    const x = Math.random() * marbleCanvas.width;
    const y = Math.random() * marbleCanvas.height;
    const angle = Math.random() * Math.PI * 2;
    
    marbleCtx.beginPath();
    marbleCtx.moveTo(x, y);
    marbleCtx.bezierCurveTo(
      x + curve, y + curve, 
      x + length/2, y + curve, 
      x + length, y
    );
    
    marbleCtx.lineWidth = thickness;
    // 设置灰色调的大理石纹理
    const grayValue = Math.floor(Math.random() * 55 + 200);
    marbleCtx.strokeStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    marbleCtx.stroke();
  }
  
  // 添加细微纹理
  for (let i = 0; i < 200; i++) {
    const size = Math.random() * 4 + 1;
    const x = Math.random() * marbleCanvas.width;
    const y = Math.random() * marbleCanvas.height;
    const grayValue = Math.floor(Math.random() * 55 + 200);
    
    marbleCtx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    marbleCtx.fillRect(x, y, size, size);
  }
  
  // 创建纹理
  const marbleTexture = new THREE.CanvasTexture(marbleCanvas);
  marbleTexture.wrapS = THREE.RepeatWrapping;
  marbleTexture.wrapT = THREE.RepeatWrapping;
  marbleTexture.repeat.set(1, 1);
  
  const cubeMaterial1 = new THREE.MeshStandardMaterial({
    map: marbleTexture,
    roughness: 0.3,
    metalness: 0.1,
    bumpMap: marbleTexture,
    bumpScale: 0.05
  });
  
  const cubeStand1 = new THREE.Mesh(cubeGeometry1, cubeMaterial1);
  cubeStand1.position.set(10, 0.5, 3);
  cubeStand1.name = "marbleStand1";
  cubeStand1.isExhibitStand = true; // 标记为展台以便正确处理碰撞
  cubeStand1.castShadow = true;
  cubeStand1.receiveShadow = true;
  vr._scene.add(cubeStand1);
  
  // 创建一个展台底座
  const baseCubeGeometry1 = new THREE.BoxGeometry(1.2, 0.2, 1.2);
  const baseCubeMaterial1 = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7,
    roughness: 0.2
  });
  const baseCube1 = new THREE.Mesh(baseCubeGeometry1, baseCubeMaterial1);
  baseCube1.position.set(10, -0.99, 3);
  baseCube1.name = "baseStand1";
  baseCube1.castShadow = true;
  baseCube1.receiveShadow = true;
  vr._scene.add(baseCube1);

  // 创建第二个展台 - 金属纹理
  const cubeGeometry2 = new THREE.BoxGeometry(1, 3, 1);
  
  // 创建金属纹理的Canvas
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = 512;
  metalCanvas.height = 512;
  const metalCtx = metalCanvas.getContext('2d');
  
  // 创建金属渐变背景
  const metalGradient = metalCtx.createLinearGradient(0, 0, metalCanvas.width, metalCanvas.height);
  metalGradient.addColorStop(0, '#888888');
  metalGradient.addColorStop(0.5, '#cccccc');
  metalGradient.addColorStop(1, '#a0a0a0');
  metalCtx.fillStyle = metalGradient;
  metalCtx.fillRect(0, 0, metalCanvas.width, metalCanvas.height);
  
  // 添加细微的金属划痕
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * metalCanvas.width;
    const y = Math.random() * metalCanvas.height;
    const length = Math.random() * 100 + 20;
    const angle = Math.random() * Math.PI;
    
    metalCtx.beginPath();
    metalCtx.moveTo(x, y);
    metalCtx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    metalCtx.lineWidth = Math.random() * 1.5 + 0.5;
    
    // 随机亮度
    const brightness = Math.floor(Math.random() * 40 + 170);
    metalCtx.strokeStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    metalCtx.stroke();
  }
  
  // 添加一些亮点
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * metalCanvas.width;
    const y = Math.random() * metalCanvas.height;
    const radius = Math.random() * 3 + 1;
    
    metalCtx.beginPath();
    metalCtx.arc(x, y, radius, 0, Math.PI * 2);
    metalCtx.fillStyle = '#e0e0e0';
    metalCtx.fill();
  }
  
  // 创建纹理
  const metalTexture = new THREE.CanvasTexture(metalCanvas);
  metalTexture.wrapS = THREE.RepeatWrapping;
  metalTexture.wrapT = THREE.RepeatWrapping;
  metalTexture.repeat.set(1, 1);
  
  const cubeMaterial2 = new THREE.MeshStandardMaterial({
    map: metalTexture,
    roughness: 0.2,
    metalness: 0.8,
    envMap: vr._scene.environment,
    envMapIntensity: 1.0
  });
  
  const cubeStand2 = new THREE.Mesh(cubeGeometry2, cubeMaterial2);
  cubeStand2.position.set(15, 0.5, 3);
  cubeStand2.name = "metalStand2";
  cubeStand2.isExhibitStand = true;
  cubeStand2.castShadow = true;
  cubeStand2.receiveShadow = true;
  vr._scene.add(cubeStand2);
  
  // 创建第二个展台底座
  const baseCubeGeometry2 = new THREE.BoxGeometry(1.2, 0.2, 1.2);
  const baseCubeMaterial2 = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7,
    roughness: 0.2
  });
  const baseCube2 = new THREE.Mesh(baseCubeGeometry2, baseCubeMaterial2);
  baseCube2.position.set(15, -0.99, 3);
  baseCube2.name = "baseStand2";
  baseCube2.castShadow = true;
  baseCube2.receiveShadow = true;
  vr._scene.add(baseCube2);

  // 创建第三个展台 - 木质纹理
  const cubeGeometry3 = new THREE.BoxGeometry(1, 2, 1);
  
  // 创建木质纹理的Canvas
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const woodCtx = woodCanvas.getContext('2d');
  
  // 设置木质背景色
  woodCtx.fillStyle = '#a67c52';
  woodCtx.fillRect(0, 0, woodCanvas.width, woodCanvas.height);
  
  // 创建木纹
  for (let i = 0; i < 30; i++) {
    // 木纹线
    const y = i * (woodCanvas.height / 30);
    const lineWidth = Math.random() * 10 + 10;
    
    woodCtx.beginPath();
    woodCtx.moveTo(0, y);
    
    // 创建不规则波浪状木纹
    for (let x = 0; x < woodCanvas.width; x += 30) {
      const yOffset = Math.random() * 10 - 5;
      woodCtx.lineTo(x, y + yOffset);
    }
    
    woodCtx.lineWidth = lineWidth;
    woodCtx.strokeStyle = '#8B5A2B'; // 棕色木纹
    woodCtx.globalAlpha = 0.2;
    woodCtx.stroke();
    woodCtx.globalAlpha = 1.0;
  }
  
  // 添加木节
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * woodCanvas.width;
    const y = Math.random() * woodCanvas.height;
    const radius = Math.random() * 15 + 5;
    
    // 创建木节
    const gradient = woodCtx.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, '#4E2E0C');
    gradient.addColorStop(0.7, '#8B5A2B');
    gradient.addColorStop(1, '#a67c52');
    
    woodCtx.beginPath();
    woodCtx.arc(x, y, radius, 0, Math.PI * 2);
    woodCtx.fillStyle = gradient;
    woodCtx.fill();
    
    // 添加木节纹路
    for (let j = 0; j < 3; j++) {
      woodCtx.beginPath();
      woodCtx.arc(x, y, radius * (0.8 - j * 0.2), 0, Math.PI * 2);
      woodCtx.lineWidth = 1;
      woodCtx.strokeStyle = '#4E2E0C';
      woodCtx.globalAlpha = 0.5;
      woodCtx.stroke();
    }
    woodCtx.globalAlpha = 1.0;
  }
  
  // 创建纹理
  const woodTexture = new THREE.CanvasTexture(woodCanvas);
  woodTexture.wrapS = THREE.RepeatWrapping;
  woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(1, 2);
  
  const cubeMaterial3 = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.6,
    metalness: 0.1,
    bumpMap: woodTexture,
    bumpScale: 0.03
  });
  
  const cubeStand3 = new THREE.Mesh(cubeGeometry3, cubeMaterial3);
  cubeStand3.position.set(20, 0.6, 8);
  cubeStand3.name = "woodStand3";
  cubeStand3.isExhibitStand = true;
  cubeStand3.castShadow = true;
  cubeStand3.receiveShadow = true;
  vr._scene.add(cubeStand3);
  
  // 创建第三个展台底座
  const baseCubeGeometry3 = new THREE.BoxGeometry(1.2, 0.2, 1.2);
  const baseCubeMaterial3 = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7,
    roughness: 0.2
  });
  const baseCube3 = new THREE.Mesh(baseCubeGeometry3, baseCubeMaterial3);
  baseCube3.position.set(20, -0.5, 8);
  baseCube3.name = "baseStand3";
  baseCube3.castShadow = true;
  baseCube3.receiveShadow = true;
  vr._scene.add(baseCube3);
  
  // 添加展台照明
  function addStandLight(x, y, z, targetObject, color = 0xffffff) {
    // 添加聚光灯照亮展台
    const spotLight = new THREE.SpotLight(color, 1.5);
    spotLight.position.set(x, y + 3, z);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.3;
    spotLight.decay = 1.5;
    spotLight.distance = 8;
    spotLight.castShadow = true;
    
    // 设置阴影参数
    spotLight.shadow.mapSize.width = 512;
    spotLight.shadow.mapSize.height = 512;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 10;
    
    // 设置聚光灯目标
    spotLight.target = targetObject;
    
    vr._scene.add(spotLight);
    return spotLight;
  }
  
  // 为每个展台添加照明
  const stand1Light = addStandLight(10, 4, 3, cubeStand1, 0xffffee);
  const stand2Light = addStandLight(15, 4, 3, cubeStand2, 0xeeeeff);
  const stand3Light = addStandLight(20, 4, 8, cubeStand3, 0xffeedd);

  // 在添加展台后重新设置碰撞对象
  vr._setupCollisionObjects();

  // 在第一个白色展台上添加飞船模型
  vr.loadGLTF({
    scale: 0.2, // 缩小尺寸以适合展台
    position: {
      x: 10, // 与第一个展台相同的x坐标
      y: 3.2, // 展台高度(0.5) + 模型高度的一半
      z: 3  // 与第一个展台相同的z坐标
    },
    rotation: {
      x: 0,
      y: Math.PI / 4, // 旋转45度，使模型朝向更好看
      z: 0
    },
    url: `./assets/gltfs/feichuan.glb`,
    autoLight: true,
  }).then((gltf) => {
    gltf.scene.odata = { id: "stand1_feichuan" };
    vr.addClickEvent(gltf.scene);
    vr.createAnimate(gltf, { animateIndex: 0, duration: 10 });
  });

  // 在第二个白色展台上添加飞船模型
  vr.loadGLTF({
    scale: 0.25, // 稍微大一点，因为第二个展台更大
    position: {
      x: 15, // 与第二个展台相同的x坐标
      y: 3.0, // 展台高度(0.4) + 模型高度的一半
      z: 3   // 与第二个展台相同的z坐标
    },
    rotation: {
      x: 0,
      y: -Math.PI / 3, // 旋转不同角度
      z: 0
    },
    url: `./assets/gltfs/feichuan.glb`,
    autoLight: true,
  }).then((gltf) => {
    gltf.scene.odata = { id: "stand2_feichuan" };
    vr.addClickEvent(gltf.scene);
    vr.createAnimate(gltf, { animateIndex: 0, duration: 8 });
  });

  // 在第三个展台上加载OBJ模型
  // 创建加载管理器
  const manager = new THREE.LoadingManager();
  // 使用MTLLoader加载材质
  const mtlLoader = new MTLLoader(manager);
  mtlLoader.setPath('./assets/high/');
  // 加载MTL和OBJ
  async function loadPorcelainVase() {
    try {
      console.log('开始加载MTL文件...');
      const materials = await new Promise((resolve, reject) => {
        mtlLoader.load('4444444.mtl', resolve, undefined, reject);
      });

      console.log('MTL文件加载成功，预加载材质...');
      materials.preload();

      const objLoader = new OBJLoader(manager);
      objLoader.setMaterials(materials);
      objLoader.setPath('./assets/high/');

      const object = await objLoader.loadAsync('4444444.obj');
      object.position.set(20, 2.32, 8); // 第三个展台上方
      object.scale.setScalar(0.003); // 使用固定缩放值
      object.rotation.y = Math.PI / 4; // 旋转45度方便观看

      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.computeBoundingSphere();
          child.geometry.computeVertexNormals();
          child.frustumCulled = true;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
          }
        }
      });
      // 添加点击事件数据
      object.odata = { id: "青花瓷瓶" };
      vr.addClickEvent(object);
      // 添加到场景
      vr._scene.add(object);
      // 添加轻微旋转动画
      let startTime = Date.now();
      vr.addAnimate((delta) => {
        const time = (Date.now() - startTime) / 1000;
        object.rotation.y = Math.PI / 4 + Math.sin(time * 0.5) * 0.2;
      });

      // 更新碰撞检测
      vr._setupCollisionObjects();

      // 优化墙壁碰撞检测参数
      optimizeCollisionDetection(vr);

    } catch (error) {
      console.error('加载青花瓷瓶过程中出错:', error);
      // 创建一个简单的替代模型
      createFallbackVase();
    }
  }

  // 优化碰撞检测的函数
  function optimizeCollisionDetection(vr) {
    if (!vr._keyboardControls) {
      console.log('未找到键盘控制器，无法优化碰撞检测');
      return;
    }

    console.log('优化墙壁碰撞检测参数...');

    // 优化碰撞检测参数
    // 增加碰撞距离以防止穿墙
    vr._keyboardControls.collisionDistance = 0.8;
    // 增加展台碰撞距离
    vr._keyboardControls.exhibitStandCollisionDistance = 0.8;
    // 增加视角碰撞检测距离
    vr._keyboardControls.viewCollisionDistance = 0.5;
    // 增加玩家半径
    vr._keyboardControls.playerRadius = 0.45;

    // 优化检测数组
    // 创建专用的墙壁碰撞检测数组
    const wallObjects = vr.collisionObjects.filter(obj =>
      obj.isWall ||
      (obj.name && (
        obj.name.includes('qiang') ||
        obj.name.includes('wall') ||
        obj.name.includes('men') ||
        obj.name.includes('door')
      ))
    );

    // 为每个墙壁对象创建更严格的碰撞体积（如果还没有创建）
    wallObjects.forEach(wall => {
      // 检查是否已经有碰撞辅助体
      const hasCollisionHelper = vr.collisionObjects.some(obj =>
        obj.isCollisionHelper && obj.name && obj.name.includes(wall.name)
      );

      if (!hasCollisionHelper && wall.geometry) {
        // 创建额外的碰撞盒，稍微扩大尺寸
        const collisionBox = createWallCollisionBox(wall);
        if (collisionBox) {
          vr._scene.add(collisionBox);
          vr.collisionObjects.push(collisionBox);
          console.log('为墙壁创建额外碰撞体:', wall.name);
        }
      }
    });

    // 重新设置碰撞对象
    vr._keyboardControls.setCollisionObjects(vr.collisionObjects);

    console.log('碰撞检测参数优化完成');
  }

  // 创建墙壁的碰撞盒
  function createWallCollisionBox(wall) {
    if (!wall.geometry) return null;

    // 计算边界盒
    const boundingBox = new THREE.Box3().setFromObject(wall);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // 创建稍微大一点的碰撞盒
    const geometry = new THREE.BoxGeometry(
      size.x * 1.05,
      size.y * 1.05,
      size.z * 1.05
    );

    // 创建透明材质
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.0, // 完全不可见
      depthWrite: false
    });

    // 创建碰撞网格
    const collisionMesh = new THREE.Mesh(geometry, material);

    // 设置位置
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    collisionMesh.position.copy(center);

    // 设置旋转和缩放
    collisionMesh.rotation.copy(wall.rotation);

    // 标记为墙壁碰撞辅助体
    collisionMesh.isWallOrFloor = true;
    collisionMesh.isWall = true;
    collisionMesh.isCollisionHelper = true;
    collisionMesh.name = wall.name + "_collision";

    return collisionMesh;
  }

  // 执行加载函数
  loadPorcelainVase();

  // 创建替代花瓶的函数
  function createFallbackVase() {
    console.log('创建替代青花瓷瓶模型');

    // 创建简单的几何体和材质
    const geometry = new THREE.CylinderGeometry(0.4, 0.3, 1.0, 32);

    // 创建青花瓷效果的材质
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000033,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // 创建青花瓷图案
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // 白色背景
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 添加蓝色花纹
    context.fillStyle = '#1E90FF';
    for (let i = 0; i < 8; i++) {
      const x = canvas.width / 8 * i;
      const y = canvas.height / 2;
      const radius = 15;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    // 添加装饰线条
    context.strokeStyle = '#0000CD';
    context.lineWidth = 2;

    // 顶部和底部的水平线
    context.beginPath();
    context.moveTo(0, 50);
    context.lineTo(canvas.width, 50);
    context.stroke();

    context.beginPath();
    context.moveTo(0, canvas.height - 50);
    context.lineTo(canvas.width, canvas.height - 50);
    context.stroke();

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    material.map = texture;

    // 创建网格
    const vase = new THREE.Mesh(geometry, material);
    vase.position.set(20, 1.4, 8);
    vase.name = "fallbackVase";
    vase.castShadow = true;
    vase.receiveShadow = true;

    // 添加到场景
    vr._scene.add(vase);

    // 添加点击事件
    vase.odata = { id: "青花瓷瓶(替代)" };
    vr.addClickEvent(vase);

    // 添加轻微旋转动画
    let startTime = Date.now();
    vr.addAnimate((delta) => {
      const time = (Date.now() - startTime) / 1000;
      vase.rotation.y = Math.sin(time * 0.5) * 0.2;
    });
  }

  // 所有内容加载完成后，刷新碰撞检测对象
  setTimeout(() => {
    if (vr._options.keyboardControls && vr._options.keyboardControls.enabled) {
      // 刷新碰撞对象
      vr._setupCollisionObjects();

      // 全局优化碰撞检测
      if (vr._keyboardControls) {
        // 设置更优的碰撞参数
        vr._keyboardControls.collisionDistance = 0.8;
        vr._keyboardControls.exhibitStandCollisionDistance = 0.8;
        vr._keyboardControls.viewCollisionDistance = 0.5;
        vr._keyboardControls.playerRadius = 0.45;

        // 启用墙壁滑动，防止卡墙
        vr._keyboardControls.slideEnabled = true;

        // 提高碰撞检测精度
        vr._keyboardControls.debug = false; // 关闭调试信息

        // 确保每个墙壁和展台都有正确的标记
        vr.collisionObjects.forEach(obj => {
          // 自动识别墙壁和展台
          const name = obj.name ? obj.name.toLowerCase() : '';

          // 标记墙壁
          if (name.includes('qiang') ||
            name.includes('wall') ||
            name.includes('men') ||
            name.includes('door')) {
            obj.isWallOrFloor = true;
            obj.isWall = true;
          }

          // 标记展台
          if (name.includes('stand') ||
            name.includes('table') ||
            name.includes('dizuo') ||
            name.includes('platform')) {
            obj.isExhibitStand = true;
          }

          // 标记地面
          if (name.includes('floor') ||
            name.includes('ground') ||
            name.includes('dimian') ||
            name.includes('di')) {
            obj.isWallOrFloor = true;
            obj.isFloor = true;
          }
        });

        // 重新设置碰撞检测对象
        vr._keyboardControls.setCollisionObjects(vr.collisionObjects);
      }

      console.log('所有内容加载完成后刷新碰撞检测对象，优化了碰撞检测参数');
    }
  }, 2000);

  // vr.initVRButton();

  // 导览点
  let shtml = "";
  data.forEach((d) => {
    shtml += `<li class="item" data-id="${d.id}">展品:${d.id}</li>`;
  });
  shtml += `<li class="gravity">重力感应</li>`;
  shtml += `<li class="keyboard active">键盘移动 (开启)</li>`;

  document.querySelector(".view").innerHTML = shtml;

  document.querySelector(".gravity").addEventListener("click", () => {
    if (document.location.protocol === "https:") {
      vr.gravity.toggle();
    } else {
      alert("需要开启https");
    }
  });

  // 添加键盘控制切换
  document.querySelector(".keyboard").addEventListener("click", () => {
    // 使用一个自定义属性来跟踪键盘控制状态
    const keyboardEnabled = document.querySelector('.keyboard').classList.contains('active');
    if (!keyboardEnabled) {
      vr.toggleKeyboardControls(true, 3.0); // 速度为3.0，使移动平滑
      document.querySelector('.keyboard').classList.add('active');
      document.querySelector('.keyboard').textContent = "键盘移动 (开启)";
    } else {
      vr.toggleKeyboardControls(false);
      document.querySelector('.keyboard').classList.remove('active');
      document.querySelector('.keyboard').textContent = "键盘移动";
    }
  });

  document.querySelectorAll(".item").forEach((target) => {
    target.addEventListener("click", () => {
      const id = target.dataset.id;
      vr.viewItem(id);
    });
  });
  
  // 添加一个页面加载完成后的回调，用于确保所有资源加载完成
  window.addEventListener('load', () => {
    // 初始化自动巡航功能
    console.log('页面加载完成，自动巡航功能已准备就绪');
  });
};
