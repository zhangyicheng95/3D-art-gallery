import * as THREE from 'three';

/**
 * FPS风格的键盘控制器
 */
export default class KeyboardControls {
  constructor(camera, cameraControls, domElement) {
    this.camera = camera;
    this.cameraControls = cameraControls;
    this.domElement = domElement;
    
    // 移动速度
    this.moveSpeed = 3.0; // 默认设置更低的移动速度
    // 是否启用
    this.enabled = false;
    
    // 调试模式
    this.debug = true; // 启用调试模式查看问题
    
    // 碰撞检测
    this.collisionDetection = true; // 启用碰撞检测
    this.collisionDistance = 0.6;   // 增加碰撞检测距离
    this.exhibitStandCollisionDistance = 0.6; // 增加展台碰撞距离
    this.collisionObjects = [];     // 碰撞物体数组
    this.raycaster = new THREE.Raycaster(); // 射线检测器
    // 玩家碰撞体大小（人身宽度约0.5米）
    this.playerRadius = 0.4; // 适当减小玩家碰撞半径，提高灵活性
    // 远处展台的可视优化距离
    this.farExhibitDistance = 5.0; // 增加开始优化的距离阈值
    // 远处展台的最小碰撞距离
    this.minFarExhibitCollisionDistance = 0.2; // 增加远处展台的最小碰撞距离
    // 超远距离阈值 - 超过此距离的展台将被完全忽略
    this.ultraFarDistance = 15.0; // 增加超远距离阈值
    
    // 视角旋转碰撞检测
    this.viewCollisionEnabled = true; // 启用视角碰撞检测
    this.viewCollisionDistance = 0.3; // 视角碰撞检测距离
    this.headHeight = 0.3; // 头部碰撞高度（相对于相机位置）
    
    // 按键状态
    this.keys = {
      forward: false,  // W
      backward: false, // S
      left: false,     // A
      right: false,    // D
      up: false,       // 空格
      down: false,     // Shift
    };
    
    // 方向向量
    this.moveDirection = new THREE.Vector3();
    // 相机向前方向
    this.cameraDirection = new THREE.Vector3();
    // 相机右侧方向
    this.cameraRight = new THREE.Vector3();
    
    // 绑定事件处理函数
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    
    // 最后一次检测到的碰撞对象
    this.lastCollisionObject = null;
    // 滑动系统 - 用于处理碰撞时的滑动
    this.slideEnabled = true;
    
    if (this.debug) {
      console.log('键盘控制器初始化完成', { 
        cameraControls: !!this.cameraControls,
        camera: !!this.camera
      });
    }
    
    // 监听camera-controls的旋转事件，以检测视角碰撞
    if (this.cameraControls && this.viewCollisionEnabled) {
      this.lastTargetPosition = new THREE.Vector3();
      this.cameraControls.addEventListener('control', () => {
        this._checkViewCollision();
      });
    }
  }
  
  // 启用控制器
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    
    // 添加事件监听
    window.removeEventListener('keydown', this._onKeyDown); // 确保没有重复绑定
    window.removeEventListener('keyup', this._onKeyUp);    
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    
    console.log('键盘控制已启用 - 绑定了键盘事件处理函数');
  }
  
  // 禁用控制器
  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    
    // 移除事件监听
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    
    // 重置按键状态
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });
    
    if (this.debug) {
      console.log('键盘控制已禁用');
    }
  }
  
  // 设置碰撞检测物体
  setCollisionObjects(objects) {
    this.collisionObjects = objects;
    if (this.debug) {
      console.log('设置碰撞检测物体:', objects.length);
    }
  }
  
  /**
   * 判断是否应该忽略指定距离上的碰撞检测
   * @param {number} distance - 物体与玩家的距离
   * @param {boolean} isExhibitStand - 是否为展台
   * @returns {boolean} - 是否应该忽略碰撞检测
   */
  shouldIgnoreDistance(distance, isExhibitStand) {
    // 对于展台，超过ultraFarDistance的距离完全忽略碰撞检测
    if (isExhibitStand && distance > this.ultraFarDistance) {
      return true;
    }
    
    // 对于非展台物体，可以根据需要添加其他距离过滤逻辑
    
    return false;
  }
  
  // 检测碰撞
  checkCollision(position, direction) {
    if (!this.collisionDetection || this.collisionObjects.length === 0) {
      return false;
    }
    
    // 设置射线起点和方向
    this.raycaster.set(position, direction.clone().normalize());
    
    // 判断是否需要检测展台 - 通常方向向下的时候需要更长的检测距离
    // 但对于其他方向，我们也希望严格检测展台
    const isDownwardDirection = direction.y < -0.5;
    const standDetectionDistance = isDownwardDirection ? 
        this.exhibitStandCollisionDistance * 1.5 : // 向下时的检测距离更长
        this.exhibitStandCollisionDistance;        // 其他方向的展台检测距离
        
    // 临时设置最大检测距离（后面会根据具体情况再调整）
    this.raycaster.far = Math.max(this.collisionDistance, standDetectionDistance);
    
    // 检测碰撞
    const intersects = this.raycaster.intersectObjects(this.collisionObjects, true);
    
    // 如果有碰撞，返回true
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const hitDistance = intersects[0].distance;
      
      // 记录最后一次检测到的碰撞对象，用于滑动系统
      this.lastCollisionObject = hitObject;
      
      // 判断是否是展台对象
      const isExhibitStand = this.isExhibitStand(hitObject);
      
      // 计算物体与射线起点的实际距离，用于远距离优化
      const objectDistance = position.distanceTo(intersects[0].point);
      
      // 检查是否应该忽略此距离的碰撞检测
      if (this.shouldIgnoreDistance(objectDistance, isExhibitStand)) {
        if (this.debug && Math.random() < 0.01) {
          console.log('忽略远距离碰撞:', hitObject.name, '距离:', objectDistance);
        }
        return false;
      }
      
      if (isExhibitStand) {
        // 基于距离动态调整展台碰撞距离
        let actualCollisionDistance = standDetectionDistance;
        
        // 如果距离超过设定的远距离阈值，使用更强的衰减函数
        if (objectDistance > this.farExhibitDistance) {
          // 使用二次方衰减，衰减更快
          const distanceRatio = Math.pow(this.farExhibitDistance / objectDistance, 2);
          actualCollisionDistance = Math.max(
            this.minFarExhibitCollisionDistance,
            standDetectionDistance * distanceRatio
          );
          
          if (this.debug && Math.random() < 0.01) {
            console.log('远处展台距离优化:', 
                      '原始距离:', standDetectionDistance,
                      '调整后:', actualCollisionDistance,
                      '展台距离:', objectDistance);
          }
        }
        
        // 判断碰撞
        if (hitDistance < actualCollisionDistance) {
          if (this.debug && Math.random() < 0.05) {
            console.log('检测到展台碰撞:', hitObject.name, '距离:', hitDistance, 
                      '方向:', direction.toArray(), '阈值:', actualCollisionDistance);
          }
          return true;
        }
      } else if (hitDistance < this.collisionDistance) {
        // 非展台物体使用标准碰撞距离
        if (this.debug && Math.random() < 0.05) {
          console.log('检测到碰撞:', hitObject.name, '距离:', hitDistance);
        }
        return true;
      }
    }
    
    return false;
  }
  
  // 全方位碰撞检测 - 在多个方向上发射射线检测碰撞
  checkCollisionAllDirections(position, moveDirection, isVerticalMove = false) {
    // 对垂直移动特殊处理
    if (isVerticalMove) {
      // 向下移动时，需要特别检测展台
      if (moveDirection.y < 0) {
        // 检测下方是否有展台 - 创建多个向下的射线，覆盖更大范围
        const downDirections = [
          new THREE.Vector3(0, -1, 0),         // 正下方
          new THREE.Vector3(0.3, -0.95, 0),    // 右下
          new THREE.Vector3(-0.3, -0.95, 0),   // 左下
          new THREE.Vector3(0, -0.95, 0.3),    // 前下
          new THREE.Vector3(0, -0.95, -0.3),   // 后下
        ];
        
        for (const dir of downDirections) {
          // 标准化方向向量
          const normalizedDir = dir.clone().normalize();
          
          const downRay = new THREE.Raycaster(
            position.clone(),
            normalizedDir,
            0,
            this.exhibitStandCollisionDistance * 2.0 // 进一步增加检测距离
          );
          
          const downIntersects = downRay.intersectObjects(this.collisionObjects, true);
          
          if (downIntersects.length > 0) {
            const hitObject = downIntersects[0].object;
            const hitDistance = downIntersects[0].distance;
            const isExhibitStand = this.isExhibitStand(hitObject);
            
            if (isExhibitStand) {
              // 计算物体与射线起点的实际距离，用于远距离优化
              const objectDistance = position.distanceTo(downIntersects[0].point);
              
              // 检查是否应该忽略此距离的碰撞检测
              if (this.shouldIgnoreDistance(objectDistance, isExhibitStand)) {
                if (this.debug && Math.random() < 0.01) {
                  console.log('忽略远距离多射线碰撞:', hitObject.name, '距离:', objectDistance);
                }
                continue; // 跳过此碰撞
              }
              
              // 基于距离动态调整检测阈值
              let detectionThreshold = this.exhibitStandCollisionDistance * 1.5;
              
              // 如果距离超过设定的远距离阈值，逐渐减小碰撞距离
              if (objectDistance > this.farExhibitDistance) {
                // 使用二次方衰减，衰减更快
                const distanceRatio = Math.pow(this.farExhibitDistance / objectDistance, 2);
                detectionThreshold = Math.max(
                  this.minFarExhibitCollisionDistance,
                  detectionThreshold * distanceRatio
                );
                
                if (this.debug && Math.random() < 0.01) {
                  console.log('远处展台多射线优化:', 
                            '原始阈值:', this.exhibitStandCollisionDistance * 1.5,
                            '调整后:', detectionThreshold,
                            '展台距离:', objectDistance);
                }
              }
              
              if (hitDistance < detectionThreshold) {
                if (this.debug && Math.random() < 0.05) {
                  console.log('多射线检测到展台垂直碰撞:', hitObject.name, 
                             '方向:', normalizedDir.toArray(),
                             '距离:', hitDistance,
                             '阈值:', detectionThreshold);
                }
                return true;
              }
            }
          }
        }
      }
    }
    
    // 主方向碰撞检测
    if (this.checkCollision(position, moveDirection)) {
      return true;
    }
    
    // 创建一个"玩家包围球"的碰撞检测 - 在多个方向上检测
    const forward = moveDirection.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    
    // 减少方向检测以提高性能，只检查最必要的方向
    const directions = [
      forward,                                  // 前
      right,                                    // 右
      right.clone().negate(),                   // 左
    ];
    
    // 检测所有方向
    for (const dir of directions) {
      if (this.checkCollision(position, dir)) {
        if (this.debug && Math.random() < 0.05) {
          console.log('全方位碰撞检测 - 检测到碰撞，方向:', dir.toArray());
        }
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 检查视角旋转是否会导致穿模
   * 这个函数在相机控制器旋转时调用
   */
  _checkViewCollision() {
    if (!this.viewCollisionEnabled || !this.collisionDetection || !this.enabled) {
      return;
    }
    
    // 获取当前相机位置和视线方向（从相机到目标的方向）
    const cameraPosition = this.camera.position.clone();
    const target = new THREE.Vector3();
    this.cameraControls.getTarget(target);
    
    // 计算视线方向
    const viewDirection = new THREE.Vector3().subVectors(target, cameraPosition).normalize();
    
    // 检测视线方向上是否有碰撞
    this.raycaster.set(cameraPosition, viewDirection);
    this.raycaster.far = this.viewCollisionDistance;
    
    // 只检测墙壁和天花板的视角碰撞，减少误判
    const viewCollisionObjects = this.collisionObjects.filter(obj => 
      obj.isWallOrFloor || obj.isViewCollider || obj.isExhibitStand
    );
    
    const intersects = this.raycaster.intersectObjects(viewCollisionObjects, true);
    
    if (intersects.length > 0) {
      // 如果检测到碰撞，恢复到上一个有效位置
      const hitDistance = intersects[0].distance;
      
      // 只有当碰撞距离非常接近时才处理
      if (hitDistance < this.viewCollisionDistance * 0.5) {
        const hitObject = intersects[0].object;
        
        // 避免与某些特定类型的对象（如地面）产生视角碰撞
        const objectName = hitObject.name.toLowerCase();
        if (objectName.includes('floor') || 
            objectName.includes('ground') || 
            objectName.includes('dimian') || 
            objectName.includes('di')) {
          return; // 忽略地面的视角碰撞
        }
        
        // 记录最后一次检测到的目标位置
        const currentTarget = new THREE.Vector3();
        this.cameraControls.getTarget(currentTarget);
        
        // 计算安全的目标位置 - 比碰撞点稍微远一点
        const safeDirection = viewDirection.clone().negate().multiplyScalar(0.1);
        const safeTarget = intersects[0].point.clone().add(safeDirection);
        
        // 设置新的目标位置，稍微比碰撞点远一点
        this.cameraControls.setTarget(safeTarget.x, safeTarget.y, safeTarget.z, true);
        
        if (this.debug && Math.random() < 0.05) {
          console.log('视角穿模检测 - 检测到碰撞，调整目标点:', 
                    '对象:', hitObject.name, 
                    '距离:', hitDistance,
                    '原目标:', currentTarget,
                    '新目标:', safeTarget);
        }
      }
    }
    
    // 更新最后的目标位置
    this.cameraControls.getTarget(this.lastTargetPosition);
  }
  
  /**
   * 计算滑动方向 - 当碰撞检测到墙壁时，尝试沿着墙壁滑动而不是完全停止
   * @param {THREE.Vector3} moveVector - 原始移动向量
   * @param {THREE.Vector3} position - 当前位置
   * @returns {THREE.Vector3} - 修改后的移动向量，如果不能滑动则返回零向量
   */
  calculateSlideDirection(moveVector, position) {
    if (!this.slideEnabled || !this.lastCollisionObject) {
      return new THREE.Vector3();
    }
    
    // 提取原始移动向量的水平分量，忽略Y轴
    const horizontalMove = new THREE.Vector3(moveVector.x, 0, moveVector.z).normalize();
    
    // 尝试两个正交方向的滑动
    const slideDirections = [
      new THREE.Vector3(horizontalMove.z, 0, -horizontalMove.x).normalize(), // 右侧正交
      new THREE.Vector3(-horizontalMove.z, 0, horizontalMove.x).normalize()  // 左侧正交
    ];
    
    // 尝试每个滑动方向
    for (const slideDir of slideDirections) {
      // 检查滑动方向是否可行（无碰撞）
      if (!this.checkCollision(position, slideDir)) {
        // 找到了一个可行的滑动方向
        if (this.debug && Math.random() < 0.1) {
          console.log('使用滑动方向:', slideDir.toArray());
        }
        return slideDir;
      }
    }
    
    // 如果两个方向都不行，返回零向量
    return new THREE.Vector3();
  }
  
  // 使用 camera-controls 来更新相机位置
  update(deltaTime) {
    if (!this.enabled) {
      // 如果未启用，直接返回
      if (Math.random() < 0.01) console.log('键盘控制未启用，不处理更新');
      return;
    }
    
    if (!this.cameraControls) {
      console.log('缺少cameraControls对象，无法更新相机位置');
      return;
    }
    
    // 随机打印按键状态，查看是否在处理按键
    if (Math.random() < 0.01) {
      const hasActiveKeys = Object.values(this.keys).some(value => value);
      if (hasActiveKeys) {
        console.log('当前激活的按键:', this.keys);
      }
    }
    
    // 获取当前相机位置和目标
    const position = this.camera.position.clone();
    const target = new THREE.Vector3();
    this.cameraControls.getTarget(target);
    
    // 计算前进方向和右方向
    const forward = new THREE.Vector3().subVectors(target, position).normalize();
    forward.y = 0; // 保持在水平面移动
    forward.normalize();
    
    // 修正右方向的计算方式 - 使用正确的向量叉乘顺序
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    
    // 保存原始位置，用于穿墙检测时还原
    const originalPosition = position.clone();
    const originalTarget = target.clone();
    
    // 移动向量
    const moveVector = new THREE.Vector3(0, 0, 0);
    
    // 根据按键状态添加移动
    if (this.keys.forward) moveVector.add(forward);
    if (this.keys.backward) moveVector.sub(forward);
    if (this.keys.right) moveVector.add(right);
    if (this.keys.left) moveVector.sub(right);
    
    // 如果有水平移动
    if (moveVector.length() > 0) {
      moveVector.normalize();
      // 降低单帧移动距离，避免高速穿墙
      const moveDistance = Math.min(this.moveSpeed * deltaTime, 0.1);
      
      // 计算新位置
      const newPosition = position.clone().addScaledVector(moveVector, moveDistance);
      
      // 碰撞检测
      let canMove = true;
      if (this.collisionDetection) {
        // 检查前方是否有障碍物
        canMove = !this.checkCollisionAllDirections(position, moveVector);
      }
      
      if (canMove) {
        // 计算新的目标点（保持相同的观察方向）
        const newTarget = target.clone().addScaledVector(moveVector, moveDistance);
        
        if (Math.random() < 0.01 && this.debug) {
          console.log('Moving - current position:', position);
          console.log('Moving - new position:', newPosition);
          console.log('Moving - move vector:', moveVector, 'distance:', moveDistance);
        }
        
        // 设置新位置
        this.cameraControls.setPosition(newPosition.x, newPosition.y, newPosition.z, false);
        this.cameraControls.setTarget(newTarget.x, newTarget.y, newTarget.z, false);
        
        // 输出移动成功信息
        if (Math.random() < 0.01) {
          console.log('相机已移动到新位置');
        }
      } else {
        // 尝试滑动解决方案
        const slideVector = this.calculateSlideDirection(moveVector, position);
        
        if (slideVector.length() > 0) {
          // 计算滑动后的新位置
          const slideDistance = moveDistance * 0.7; // 滑动速度略慢于直接移动
          const slidedPosition = position.clone().addScaledVector(slideVector, slideDistance);
          const slidedTarget = target.clone().addScaledVector(slideVector, slideDistance);
          
          // 应用滑动位置
          this.cameraControls.setPosition(slidedPosition.x, slidedPosition.y, slidedPosition.z, false);
          this.cameraControls.setTarget(slidedTarget.x, slidedTarget.y, slidedTarget.z, false);
          
          if (this.debug && Math.random() < 0.1) {
            console.log('应用滑动移动');
          }
        } else if (this.debug) {
          console.log('碰撞阻止移动，无法滑动');
        }
      }
    }
    
    // 处理垂直移动
    const gravity = true; // 是否启用重力
    const defaultHeight = 2.0; // 默认高度（地面高度）
    const gravityStrength = 10.0; // 降低重力强度，使下降感觉更自然
    
    // 保存水平移动计算的方向向量，供垂直移动使用
    const verticalForward = forward;
    const verticalRight = right;
    
    let verticalMove = 0;
    
    // 按下空格键时向上移动
    if (this.keys.up) {
      verticalMove = 1;
    } 
    // 按下Shift键时向下移动
    else if (this.keys.down) {
      verticalMove = -1;
    }
    // 不按任何键且高于默认高度时，启用重力使视角下降
    else if (gravity && position.y > defaultHeight) {
      // 根据高度差动态调整下降速度，高度越高下降越快
      const heightDiff = position.y - defaultHeight;
      const gravityFactor = Math.min(1.0, 0.2 + (heightDiff / 10.0)); // 高度差越大，下降越快
      verticalMove = -gravityFactor;  // 向下移动，速度由高度决定
    }
    
    if (verticalMove !== 0 || (gravity && position.y > defaultHeight)) {
      // 如果是重力导致的下降，使用重力强度而不是普通移动速度
      const verticalSpeed = verticalMove === -1 && !this.keys.down ? 
                           gravityStrength : this.moveSpeed;
      const verticalDistance = verticalSpeed * deltaTime * verticalMove;
      
      const newPosition = this.camera.position.clone();
      const newTarget = new THREE.Vector3();
      this.cameraControls.getTarget(newTarget);
      
      // 确保不会低于默认高度
      if (gravity && newPosition.y + verticalDistance < defaultHeight && verticalMove < 0) {
        // 如果下一帧会低于默认高度，就直接设为默认高度
        const heightDiff = defaultHeight - newPosition.y;
        newPosition.y = defaultHeight;
        newTarget.y += heightDiff;
      } else {
        // 垂直移动
        const verticalDirection = new THREE.Vector3(0, verticalMove, 0).normalize();
        let canMoveVertical = true;
        
        // 减少垂直碰撞检测的频率，只有在向上移动或明显下降时才检测
        if (this.collisionDetection && (verticalMove > 0 || verticalMove < -0.5)) {
          // 垂直碰撞检测
          canMoveVertical = !this.checkCollisionAllDirections(position, verticalDirection, true);
        }
        
        if (canMoveVertical) {
          newPosition.y += verticalDistance;
          newTarget.y += verticalDistance;
        } else if (this.debug && Math.random() < 0.1) {
          console.log('垂直碰撞阻止移动');
        }
      }
      
      this.cameraControls.setPosition(newPosition.x, newPosition.y, newPosition.z, false);
      this.cameraControls.setTarget(newTarget.x, newTarget.y, newTarget.z, false);
    }
    
    // 在每次更新后检查视角碰撞
    if (this.viewCollisionEnabled) {
      this._checkViewCollision();
    }
  }
  
  // 键盘按下事件处理
  _onKeyDown(event) {
    if (!this.enabled) {
      if (this.debug) console.log('键盘控制未启用，忽略按键', event.code);
      return;
    }
    
    if (this.debug) console.log('按键按下:', event.code);
    
    switch (event.code) {
      case 'KeyW':
        this.keys.forward = true;
        if (this.debug) console.log('向前移动启用');
        break;
      case 'KeyS':
        this.keys.backward = true;
        if (this.debug) console.log('向后移动启用');
        break;
      case 'KeyA':
        this.keys.left = true;
        if (this.debug) console.log('向左移动启用');
        break;
      case 'KeyD':
        this.keys.right = true;
        if (this.debug) console.log('向右移动启用');
        break;
      case 'Space':
        this.keys.up = true;
        if (this.debug) console.log('向上移动启用');
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = true;
        if (this.debug) console.log('向下移动启用');
        break;
    }
    
    if (this.debug) console.log('按键状态更新:', this.keys);
  }
  
  // 键盘释放事件处理
  _onKeyUp(event) {
    if (!this.enabled) return;
    
    switch (event.code) {
      case 'KeyW':
        this.keys.forward = false;
        break;
      case 'KeyS':
        this.keys.backward = false;
        break;
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.up = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = false;
        break;
    }
    
    if (this.debug) {
      console.log('KeyUp:', event.code, '- Keys:', this.keys);
    }
  }
  
  // 销毁控制器，移除事件监听
  dispose() {
    this.disable();
  }
  
  /**
   * 检查对象是否为展台
   * @param {THREE.Object3D} object - 要检查的对象
   * @returns {boolean} - 是否为展台
   */
  isExhibitStand(object) {
    if (!object) return false;
    
    // 首先检查对象自身的标记属性
    if (object.isExhibitStand || (object.userData && object.userData.isExhibitStand)) {
      return true;
    }
    
    // 检查对象名称是否包含展台相关关键词
    const name = object.name.toLowerCase();
    const keywords = [
      'dizuo', 'zhuotai', 'table', 'desk', 'stand', 'platform', 'tai', 
      'zhantai', 'exhibition', 'zhuo', 'collider', 'exhibit', 
      'display', 'booth', 'showcase', 'pedestal'
    ];
    
    // 如果对象名称包含任何关键词，则认为是展台
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return true;
      }
    }
    
    // 递归检查父对象
    if (object.parent) {
      return this.isExhibitStand(object.parent);
    }
    
    return false;
  }
} 