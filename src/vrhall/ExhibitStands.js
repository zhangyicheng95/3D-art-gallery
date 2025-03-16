import * as THREE from 'three';

/**
 * 创建展台
 * 该类提供了创建各种展台的功能
 */
export class ExhibitStands {
  constructor(scene) {
    this.scene = scene;
    this.stands = [];
  }

  /**
   * 创建基础展台
   * @param {Object} options - 展台配置选项
   * @param {string} options.name - 展台名称
   * @param {Object} options.position - 位置坐标 {x, y, z}
   * @param {Object} options.size - 展台尺寸 {width, height, depth}
   * @param {string} options.color - 展台颜色
   * @param {Object} options.rotation - 旋转角度 {x, y, z}
   * @returns {THREE.Mesh} 创建的展台对象
   */
  createBasicStand(options) {
    const {
      name = 'dizuo_custom', 
      position = {x: 0, y: 0, z: 0}, 
      size = {width: 1, height: 0.5, depth: 1}, 
      color = '#FFFFFF',
      rotation = {x: 0, y: 0, z: 0}
    } = options;

    // 创建几何体
    const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
    
    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
    });
    
    // 创建展台网格
    const standMesh = new THREE.Mesh(geometry, material);
    standMesh.name = name;
    
    // 设置位置
    standMesh.position.set(position.x, position.y, position.z);
    
    // 设置旋转角度
    standMesh.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // 标记为展台对象
    standMesh.isExhibitStand = true;
    standMesh.userData = {
      isExhibitStand: true,
      type: 'custom_stand'
    };
    
    // 添加到场景
    this.scene.add(standMesh);
    this.stands.push(standMesh);
    
    return standMesh;
  }
  
  /**
   * 创建有质感的展台（带纹理）
   * @param {Object} options - 展台配置选项
   * @param {string} options.name - 展台名称
   * @param {Object} options.position - 位置坐标 {x, y, z}
   * @param {Object} options.size - 展台尺寸 {width, height, depth}
   * @param {string} options.texturePath - 纹理图片路径
   * @param {Object} options.rotation - 旋转角度 {x, y, z}
   * @returns {THREE.Mesh} 创建的展台对象
   */
  createTexturedStand(options) {
    const {
      name = 'dizuo_textured', 
      position = {x: 0, y: 0, z: 0}, 
      size = {width: 1, height: 0.5, depth: 1}, 
      texturePath = './assets/room2/textures/dizuo1_MA.jpg',
      rotation = {x: 0, y: 0, z: 0}
    } = options;
    
    // 创建几何体
    const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
    
    // 加载纹理
    const texture = new THREE.TextureLoader().load(texturePath);
    
    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: texture,
      depthFunc: 3
    });
    
    // 创建展台网格
    const standMesh = new THREE.Mesh(geometry, material);
    standMesh.name = name;
    
    // 设置位置
    standMesh.position.set(position.x, position.y, position.z);
    
    // 设置旋转角度
    standMesh.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // 标记为展台对象
    standMesh.isExhibitStand = true;
    standMesh.userData = {
      isExhibitStand: true,
      type: 'textured_stand'
    };
    
    // 添加到场景
    this.scene.add(standMesh);
    this.stands.push(standMesh);
    
    return standMesh;
  }
  
  /**
   * 创建圆柱形展台
   * @param {Object} options - 展台配置选项
   * @param {string} options.name - 展台名称
   * @param {Object} options.position - 位置坐标 {x, y, z}
   * @param {number} options.radius - 半径
   * @param {number} options.height - 高度
   * @param {string} options.color - 颜色
   * @param {Object} options.rotation - 旋转角度 {x, y, z}
   * @returns {THREE.Mesh} 创建的展台对象
   */
  createCylinderStand(options) {
    const {
      name = 'dizuo_cylinder', 
      position = {x: 0, y: 0, z: 0}, 
      radius = 0.5,
      height = 0.5,
      color = '#FFFFFF',
      rotation = {x: 0, y: 0, z: 0}
    } = options;
    
    // 创建几何体
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
    
    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color)
    });
    
    // 创建展台网格
    const standMesh = new THREE.Mesh(geometry, material);
    standMesh.name = name;
    
    // 设置位置
    standMesh.position.set(position.x, position.y, position.z);
    
    // 设置旋转角度
    standMesh.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // 标记为展台对象
    standMesh.isExhibitStand = true;
    standMesh.userData = {
      isExhibitStand: true,
      type: 'cylinder_stand'
    };
    
    // 添加到场景
    this.scene.add(standMesh);
    this.stands.push(standMesh);
    
    return standMesh;
  }
  
  /**
   * 获取所有创建的展台
   * @returns {Array} 所有创建的展台对象数组
   */
  getAllStands() {
    return this.stands;
  }
} 