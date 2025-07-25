import * as THREE from 'https://cdn.skypack.dev/three';
import { OrbitControls } from 'https://cdn.skypack.dev/three/examples/jsm/controls/OrbitControls.js';
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise';
import { MeshLine, MeshLineMaterial } from 'https://cdn.skypack.dev/meshline'; // you might need to use a working meshline implementation or CDN

console.clear();

class Walker {
  
  constructor(config) {
    this.simplex = config.simplex;
    this.total = config.total;
    this.x = config.x;
    this.y = config.y;
    this.dir = config.dir;
    this.speed = config.speed;
    this.delta = config.delta;
    this.time = config.time;
    this.angleRange = config.angleRange;
    this.away = config.away;
    this.depth = config.depth;

    this.position = new THREE.Vector3(this.x, this.y, 0);
    this.path = [];
    
    this.build();
  }
  
  build() {
    for(let i = 0; i < this.total; i++) {
      this.step(i / this.total);
    }
  }
  
  step(p) {
    // progress the time for noise
    this.time += this.delta;
    
    // get noise values for angle and speed
    this.angle = Calc.map(this.simplex.noise2D(this.time, 0), -1, 1, -this.angleRange, this.angleRange);
    this.speed = Calc.map(this.simplex.noise2D(this.time, 1000), -1, 1, 0, 0.01);

    // apply noise values
    this.dir += this.angle;
    this.position.x += Math.cos(this.dir) * this.speed;
    this.position.y += Math.sin(this.dir) * this.speed;

    // grow away or toward the camera
    if(this.away) {
      this.position.z = Calc.map(p, 0, 1, this.depth / 2, -this.depth / 2);
    } else {
      this.position.z = Calc.map(p, 0, 1, -this.depth / 2, this.depth / 2);
    }
    
    // push new position into the path array
    this.path.push({
      x: this.position.x,
      y: this.position.y,
      z: this.position.z
    });
  } 
  
}

class Generator {
  
  constructor() {
    this.setupCamera();
    this.setupScene();
    this.setupRenderer(); 
    this.setupLines();
    this.setupOrbit();
    this.setupControls();
    
    this.lastTime = Date.now();
    this.currentTime = Date.now();
    this.deltaTime = 0;
    this.deltaTimeNorm = 0;
    
    this.listen();
    this.onResize();
    this.reset();    
    this.loop();
  }
  
  setupCamera() {
    this.fov = 75;
    this.camera = new THREE.PerspectiveCamera(this.fov, 0, 0.01, 1000);
    this.camera.position.z = 10;
  }
  
  setupScene() {
    this.scene = new THREE.Scene();
  }
  
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    document.body.appendChild(this.renderer.domElement);
  }
  
  setupOrbit() {
    this.orbit = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.2;
    this.orbit.enableKeys = false;
  }

  setupControls() {
    this.vb = new VariaBoard({
      container: document.body,
      title: 'Simplex Flower Generator',
      changeCallback: () => {
        this.reset();
      }
    });
    
    this.vb.addRange({
      id: 'lines',
      title: 'Lines',
      description: 'Amount of lines per stem',
      min: 1,
      max: 6,
      step: 1,
      default: 3,
      eased: false
    });
    
    this.vb.addRange({
      id: 'stems',
      title: 'Stems',
      description: 'Amount of stems (reflections of lines)',
      min: 1,
      max: 10,
      step: 1,
      default: 5,
      eased: false
    });
    
    this.vb.addRange({
      id: 'angle-range',
      title: 'Angle Range',
      description: 'Amount that the angle can change per noise step',
      min: 0.002,
      max: 0.018,
      step: 0.001,
      default: 0.01,
      eased: false
    });
    
    this.vb.addRange({
      id: 'depth',
      title: 'Depth',
      description: 'Depth of the flower in Z space',
      min: 0,
      max: 10,
      step: 0.1,
      default: 5,
      eased: false
    });
    
    this.vb.addRange({
      id: 'noise-speed',
      title: 'Noise Speed',
      description: 'How fast the noise values change over time',
      min: 0.000001,
      max: 0.0005,
      step: 0.000001,
      default: 0.0003,
      eased: false
    });
    
    this.vb.addRange({
      id: 'iterations',
      title: 'Iterations',
      description: 'Amount of growth iterations per stem',
      min: 500,
      max: 8000,
      step: 1,
      default: 3000,
      eased: false
    });
    
    this.vb.addRange({
      id: 'hue',
      title: 'Hue',
      description: 'Base hue of the flower',
      min: 0,
      max: 360,
      step: 1,
      default: 300,
      eased: false
    });
    
    this.vb.addRange({
      id: 'hue-range',
      title: 'Hue Range',
      description: 'Hue variance from the base hue per line',
      min: 0,
      max: 90,
      step: 1,
      default: 90,
      eased: false
    });
        
    this.vb.addRange({
      id: 'lightness',
      title: 'Lightness',
      description: 'Overall lightness of lines',
      min: 0,
      max: 100,
      step: 1,
      default: 60,
      eased: false
    });
    
    this.vb.addBoolean({
      id: 'invert',
      title: 'Invert',
      description: 'Flip the background color',
      default: false
    });
    
    this.vb.addButton({
      id: 'randomize',
      title: 'Randomize',
      description: 'Set all controls to random values',
      callback: () => {
        this.vb.randomize();
      }
    });
    
    this.vb.addButton({
      id: 'save-image',
      title: 'Save Image',
      description: 'Save flower snapshot as an image file',
      callback: (e, button, variaboard) => {
        this.renderer.render(this.scene, this.camera);
        button.dom.button.setAttribute('href', this.renderer.domElement.toDataURL('image/png'));
        button.dom.button.setAttribute('download', `simplex-flower-${Date.now()}.png`);
      }
    });
    
    this.vb.addButton({
      id: 'generate',
      title: 'Generate',
      description: 'Generate a new flower',
      callback: () => {
        this.reset();
      }
    });
  }
  
  setupLines() {
    this.meshes = [];
    this.meshGroup = new THREE.Object3D();
    this.meshGroupScale = 1;
    this.meshGroupScaleTarget = 1;
    this.scene.add(this.meshGroup);
  }
  
  generate() {
    this.simplex = new SimplexNoise();
    this.count = this.vb.get('lines');
    this.stems = this.vb.get('stems');
    this.edge = 0;
    
    this.scene.background = this.vb.get('invert') ? new THREE.Color('#fff') : new THREE.Color('#000')
    
    for(let i = 0; i < this.count; i++) {
      // setup a new walker/wanderer
      let centered = Math.random() > 0.5;
      let walker = new Walker({
        simplex: this.simplex,
        total: this.vb.get('iterations'),
        x: centered ? 0 : Calc.rand(-1, 1),
        y: centered ? 0 : Calc.rand(-1, 1),
        dir: (i / (this.count)) * ((Math.PI * 2) / this.stems),
        speed: 0,
        delta: this.vb.get('noise-speed'),
        angleRange: this.vb.get('angle-range'),
        away: 0,
        depth: this.vb.get('depth'),
        time: i * 1000
      });
      let geometry = new THREE.Geometry();
      let line = new MeshLine();

      // grab each path point and push it to the geometry
      for(let j = 0, len = walker.path.length; j < len; j++) {
        let p = walker.path[j];
        let x = p.x;
        let y = p.y;
        let z = p.z;
        this.edge = Math.max(this.edge, Math.abs(x), Math.abs(y));
        geometry.vertices.push(new THREE.Vector3(x, y, z));
      }

      // set the thickness of the line and assign the geometry
      line.setGeometry(geometry, (p) => {
        let size = 1;
        let n = size - Math.abs(Calc.map(p, 0, 1, -size, size)) + 0.1;
        return n;
      });

      // create new material based on the controls
      let material = new MeshLineMaterial({
        blending: this.vb.get('invert') ? THREE.NormalBlending : THREE.AdditiveBlending,
        color: new THREE.Color(`hsl(${360 + this.vb.get('hue') + Calc.map(i, 0, this.count, -this.vb.get('hue-range'), this.vb.get('hue-range'))}, 100%, ${this.vb.get('lightness')}%)`),
        depthTest: false,
        opacity: 1,
        transparent: true,
        lineWidth: 0.04,
        resolution: this.resolution
      });

      // create meshes for all of the stems/reflections
      for(let k = 0; k < this.stems; k++) {
        let mesh = new THREE.Mesh(line.geometry, material);
        mesh.rotation.z = Calc.map(k, 0, this.stems, 0, Math.PI * 2);
        this.meshes.push(mesh);
        this.meshGroup.add(mesh);
      }
    }     
  }
  
  worldToScreen(vector, camera) {
    vector.project(camera);
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    vector.x = (vector.x * cx) + cx;
    vector.y = -(vector.y * cy) + cy;
    return vector;
  }
  
  reset() {
    // empty out meshes array
    if(this.meshes) {
      this.meshes.length = 0;
    }

    // remove all children from mesh group
    if(this.meshGroup) {
      while(this.meshGroup.children.length) {
        this.meshGroup.remove(this.meshGroup.children[0]);
      }
    }
    
    // reset the camera
    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z = 10;
    this.camera.lookAt(new THREE.Vector3());
    
    // initialize progres values
    this.progress = 0; // overall progress ticker
    this.progressed = false; // has run once
    this.progressModulo = 0; // resets progress on modulus
    this.progressEffective = 0; // progress amount to use
    this.progressEased = 0; // eased progress
    
    this.generate();
    
    requestAnimationFrame(() => {
      // scale until the flower roughly fits within the viewport
      let tick = 0;
      let exit = 50;
      let scale = 1;
      this.meshGroup.scale.set(scale, scale, scale);
      let scr = this.worldToScreen(new THREE.Vector3(0, this.edge, 0), this.camera);
      while(scr.y < window.innerHeight * 0.2 && tick <= exit) {
        scale -= 0.05;
        scr = this.worldToScreen(new THREE.Vector3(0, this.edge * scale, 0), this.camera);
        tick++;
      }
      this.meshGroupScaleTarget = scale;
    });
  }
  
  listen() {
    window.addEventListener('resize', () => this.onResize());
  }
  
  onResize() {
    this.resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.dpr = window.devicePixelRatio > 1 ? 2 : 1;
    
    this.camera.aspect = this.resolution.x / this.resolution.y;
		this.camera.updateProjectionMatrix();

		this.renderer.setPixelRatio(this.dpr);
		this.renderer.setSize(this.resolution.x, this.resolution.y);
  }
  
  loop() {
    this.lastTime = this.currentTime;
    this.currentTime = Date.now();
    this.deltaTime = this.currentTime - this.lastTime;
    this.deltaTimeNorm = this.deltaTime / (1000 / 60);
        
    // subtly rotate the mesh
    this.meshGroup.rotation.x = Math.cos(Date.now() * 0.001) * 0.1;
    this.meshGroup.rotation.y = Math.sin(Date.now() * 0.001) * -0.1;
    
    // handle all the funky progress math
    // there is a cleaner way of doing this, I'll find it
    this.progress += 0.005 * this.deltaTimeNorm;
    if(this.progress > 1) {
      this.progressed = true;
    }
    this.progressModulo = this.progress % 2;
    this.progressEffective = this.progressModulo < 1 ? this.progressModulo : 1 - (this.progressModulo - 1);
    this.progressEased = this.progressed ? Ease.inOutExpo(this.progressEffective, 0, 1, 1) : Ease.outExpo(this.progressEffective, 0, 1, 1) ;
    
    // loop over all meshes and update their opacity and visibility
    let i = this.meshes.length;
    while(i--) {
      let mesh = this.meshes[i];
      mesh.material.uniforms.opacity.value = Calc.clamp(this.progressEffective * 2, 0, 1);
      mesh.material.uniforms.visibility.value = this.progressEased;
    }
    
    // ease the scale of the mesh
    // this.meshGroupScale += (this.meshGroupScaleTarget - this.meshGroupScale) * 1;
    this.meshGroupScale = this.meshGroupScaleTarget;
    this.meshGroup.scale.set(this.meshGroupScale, this.meshGroupScale, this.meshGroupScale);
    
    // update orbit controls
    this.orbit.update();
    
    // render the scene and queue up another frame
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(() => this.loop());
  }
  
}

setTimeout(() => {
  let generator = new Generator();
}, 250);