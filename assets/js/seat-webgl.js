// Local, pinned WebGL renderer. Booking IDs and camera behaviour belong to the existing viewer.
import * as THREE from '../lib/three/three.module.min.js';

function geometryFromFaces(faces, transform = p => p) {
    const positions = [], uv = [];
    for (const face of faces) {
        const points = face.points.map(transform);
        for (let i = 1; i < points.length - 1; i++) {
            for (const j of [0, i, i + 1]) {
                positions.push(...points[j]);
                uv.push(...([[0, 0], [1, 0], [1, 1], [0, 1]][j] || [0, 0]));
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
}

function create({onContextLost} = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'ts-seat-webgl-surface';
    canvas.setAttribute('aria-hidden', 'true');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'}); }
    catch (_) { return null; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const camera = new THREE.PerspectiveCamera();
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const matrix = new THREE.Object3D(), color = new THREE.Color();
    let world, source, chairs = [], people = [], pickables = [], beams = [], room, sky;
    let ledCanvas, ledContext, ledTexture, lastLed = -1, lastArtwork, lastState, lastWidth = 0, lastHeight = 0;
    let disposed = false;
    const lost = event => { event.preventDefault(); onContextLost?.(); };
    canvas.addEventListener('webglcontextlost', lost);

    function clear() {
        if (world) {
            const geometries = new Set(), materials = new Set(), textures = new Set();
            world.traverse(object => {
                if (object.geometry) geometries.add(object.geometry);
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                    if (!material) continue;
                    materials.add(material);
                    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
                }
                if (object.isInstancedMesh) object.dispose();
            });
            geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
        }
        chairs = []; people = []; beams = []; pickables = []; lastState = null; lastLed = -1; lastArtwork = null;
        renderer.renderLists.dispose();
    }
    const standard = (value, roughness = .65, metalness = .1) => new THREE.MeshStandardMaterial({color:value, roughness, metalness, side:THREE.DoubleSide});
    function addMesh(geometry, material, parent = world) {
        const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
    }
    function build(next) {
        clear(); source = next; world = new THREE.Scene();
        world.background = new THREE.Color('#0b1020');
        // Camera-centred sky: fills the space around the venue in overview and seat view.
        // It has no lighting, fog, depth writes or pickable geometry.
        sky=addMesh(new THREE.SphereGeometry(1,32,16),new THREE.ShaderMaterial({
            side:THREE.BackSide,depthWrite:false,depthTest:false,
            vertexShader:'varying vec3 direction; void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}',
            fragmentShader:`
                varying vec3 direction;
                float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
                void main(){
                    vec3 d=normalize(direction);
                    vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5);
                    vec3 colour=mix(vec3(.065,.085,.16),vec3(.018,.027,.075),smoothstep(0.,.85,abs(d.y)));
                    float haze=pow(max(0.,1.-abs(d.y-.15)),8.)*.025;
                    colour+=vec3(.4,.25,.8)*haze;
                    vec2 grid=uv*vec2(320.,160.),cell=floor(grid);
                    float seed=hash(cell);
                    vec2 offset=vec2(hash(cell+17.),hash(cell+43.))*.6+.2;
                    float distanceToStar=length(fract(grid)-offset);
                    float star=(1.-smoothstep(.015,.075+hash(cell+7.)*.055,distanceToStar))*step(.965,seed);
                    float halo=(1.-smoothstep(0.,.24,distanceToStar))*step(.992,seed)*.15;
                    colour+=(star+halo)*mix(vec3(.65,.78,1.),vec3(1.,.91,.75),hash(cell+91.));
                    gl_FragColor=vec4(colour,1.);
                }`
        }));
        sky.renderOrder=-100;sky.frustumCulled=false;
        world.fog = new THREE.Fog('#0b1020', source.radius * 2, source.radius * 6);
        world.add(new THREE.HemisphereLight('#cedfff', '#222635', 2.2));
        const key = new THREE.DirectionalLight('#fff0df', 3.2);
        key.position.set(source.center[0] - source.radius * .4, source.radius, source.center[2] + source.radius * .3);
        key.target.position.fromArray(source.center); world.add(key, key.target);
        key.castShadow = true;
        key.shadow.mapSize.set(window.innerWidth < 700 ? 1024 : 2048, window.innerWidth < 700 ? 1024 : 2048);
        Object.assign(key.shadow.camera, {left:-source.radius, right:source.radius, top:source.radius, bottom:-source.radius, near:.1, far:source.radius * 4});
        key.shadow.bias = -.0002; key.shadow.normalBias = .025;
        const fill = new THREE.DirectionalLight('#879fff', 1.1); fill.position.set(0, 12, -source.radius); world.add(fill);

        // Reuse one detailed chair mesh for every physical seat; the index maps to the saved seat ID.
        const first = source.seats[0];
        const local = p => {
            const x = p[0] - first.x, z = p[2] - first.z, c = Math.cos(first.angle), s = Math.sin(first.angle);
            return [x*c-z*s, p[1], x*s+z*c];
        };
        for (const kind of ['chair', 'support']) {
            const geometry = geometryFromFaces(source.meshes.chairFaces[0].filter(face => face.kind === kind), local);
            const mesh = new THREE.InstancedMesh(geometry, standard(kind === 'chair' ? '#ffffff' : '#39424b', kind === 'chair' ? .46 : .3, kind === 'chair' ? .08 : .7), source.seats.length);
            mesh.userData.seatInstances = true; mesh.userData.coloured = kind === 'chair';
            mesh.castShadow = true; mesh.receiveShadow = true;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            world.add(mesh); chairs.push(mesh); pickables.push(mesh);
        }
        ledCanvas = document.createElement('canvas'); ledCanvas.width = 1024; ledCanvas.height = 512;
        ledContext = ledCanvas.getContext('2d'); ledTexture = new THREE.CanvasTexture(ledCanvas); ledTexture.colorSpace = THREE.SRGBColorSpace;
        const colours = {stage:'#19222c', wood:'#29313e', floor:'#333d4b', floorBase:'#171d28', backdrop:'#070b13', truss:'#84919d', support:'#4b5663', speaker:'#10151c', speakerGrille:'#343c47', woofer:'#06090e', dustCap:'#596472', trim:'#7c8d9c'};
        const kinds = new Map();
        for (const face of source.meshes.venueFaces) {
            // LED artwork supplies its own graphics; keep the physical stage's measured placement.
            if (face.kind === 'screenBar') continue;
            if (!kinds.has(face.kind)) kinds.set(face.kind, []);
            kinds.get(face.kind).push(face);
        }
        for (const [kind, faces] of kinds) {
            const material = kind === 'screen' ? new THREE.MeshBasicMaterial({map:ledTexture, side:source.stage.surrounded?THREE.FrontSide:THREE.DoubleSide, toneMapped:false}) :
                kind === 'light' ? new THREE.MeshBasicMaterial({color:'#bcfaff', toneMapped:false}) : standard(colours[kind] || '#62778b', kind === 'floor' ? .9 : .5, kind === 'truss' ? .8 : .16);
            const mesh = addMesh(geometryFromFaces(faces), material);
            mesh.receiveShadow = true; mesh.castShadow = !['floor','floorBase','screen','light'].includes(kind);
            pickables.push(mesh); // Stage and floor occlude seats during picking.
        }
        buildAtmosphere();
        const cap = Math.min(source.seats.length, 320);
        const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.17,.42,3,6), standard('#384967'), cap);
        const head = new THREE.InstancedMesh(new THREE.SphereGeometry(.13,8,6), standard('#d8ab8b'), cap);
        const arm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.065,1,6),standard('#384967'),cap);
        const hand = new THREE.InstancedMesh(new THREE.SphereGeometry(.065,8,6),standard('#d8ab8b'),cap);
        const stick = new THREE.InstancedMesh(new THREE.CylinderGeometry(.026,.026,1,8),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),cap);
        const glow = new THREE.InstancedMesh(new THREE.CylinderGeometry(.075,.075,1,8),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),cap);
        for (const mesh of [body,head,arm,hand,stick,glow]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; world.add(mesh); people.push(mesh); }
    }
    function buildAtmosphere() {
        const stage = source.stage, rig = new THREE.Group();
        rig.position.set(stage.x,0,stage.z); rig.rotation.y = stage.angle; world.add(rig);
        const top = stage.visualHeight || 4, metal = standard('#8496a9',.33,.85), lattice=[];
        // Open lattice front truss with diagonal bracing, inside the existing stage footprint.
        function strut(a,b,r=.025) {
            const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), direction=end.clone().sub(start);
            const indexed=new THREE.CylinderGeometry(r,r,direction.length(),5), geometry=indexed.toNonIndexed();indexed.dispose();
            geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
            const centre=start.add(end).multiplyScalar(.5);geometry.translate(centre.x,centre.y,centre.z);
            lattice.push(...geometry.attributes.position.array);geometry.dispose();
        }
        const w=stage.width*.96, z=stage.surrounded?0:stage.depth*.28;
        if(!stage.surrounded) {
        for (const x of [-w/2,w/2]) {
            for (const offset of [-.14,.14]) strut([x+offset,.8,z],[x+offset,top+.65,z]);
            for (let y=1; y<top+.3; y+=.45) strut([x-.14,y,z],[x+.14,Math.min(y+.45,top+.65),z]);
        }
        for (const y of [top+.3,top+.65]) strut([-w/2,y,z],[w/2,y,z]);
        for (let x=-w/2; x<w/2-.5; x+=.6) strut([x,top+.3,z],[Math.min(x+.6,w/2),top+.65,z]);
        }
        const trussGeometry=new THREE.BufferGeometry();trussGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lattice,3));trussGeometry.computeVertexNormals();addMesh(trussGeometry,metal,rig);
        for (let i=0;i<6;i++) {
            const lamp = new THREE.Group();
            if(stage.surrounded){const a=i/6*Math.PI*2,r=Math.min(stage.width*.25,stage.depth*.65);lamp.position.set(Math.sin(a)*r,stage.displayBottom-.2,Math.cos(a)*r);}
            else lamp.position.set((i/5-.5)*w*.88,top+.15,z);
            rig.add(lamp);
            const bulb=addMesh(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({color:i%2?'#b1e8ff':'#d9beff',toneMapped:false}),lamp);
            const length=Math.max(5,top*1.5);
            const beam=addMesh(new THREE.ConeGeometry(length*.17,length,24,1,true),new THREE.ShaderMaterial({
                transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
                uniforms:{tint:{value:new THREE.Color(i%2?'#69bdff':'#af84ff')}},
                vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
                fragmentShader:'varying vec2 vUv; uniform vec3 tint; void main(){float a=pow(vUv.y,1.5)*0.105;gl_FragColor=vec4(tint,a);}'
            }),lamp);
            beam.position.y=-length/2; lamp.rotation.x=.25; beams.push({lamp,phase:i*1.1});
        }
        // Decorative arena shell only. It supplies atmosphere, never selectable inventory.
        room = new THREE.Group(); world.add(room);
        const rx=(source.bounds.maxX-source.bounds.minX)*.75+8, rz=(source.bounds.maxZ-source.bounds.minZ)*.75+8;
        const centre=source.center, tierHeight=Math.max(1.6,source.radius*.065);
        const tiers=[], rails=[];
        for (let tier=0;tier<4;tier++) for(let i=0;i<96;i++) {
            const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2,r=1+tier*.035,y=tier*tierHeight;
            const p=(angle,h)=>[centre[0]+Math.sin(angle)*rx*r,h,centre[2]+Math.cos(angle)*rz*r];
            tiers.push({points:[p(a,y),p(b,y),p(b,y+tierHeight*.78),p(a,y+tierHeight*.78)]});
            rails.push({points:[p(a,y+tierHeight*.8),p(b,y+tierHeight*.8),p(b,y+tierHeight*.86),p(a,y+tierHeight*.86)]});
        }
        addMesh(geometryFromFaces(tiers),standard('#272e40',.9),room);
        addMesh(geometryFromFaces(rails),new THREE.MeshBasicMaterial({color:'#6c89b3'}),room);
        const points=[], colours=[];
        for(let i=0;i<2400;i++) {
            const a=i*2.399963,tier=i%4,r=1+tier*.035;
            points.push(centre[0]+Math.sin(a)*rx*r*.998,tier*tierHeight+.3+(i%11)/11*tierHeight*.55,centre[2]+Math.cos(a)*rz*r*.998);
            color.set(['#6c9bd6','#c8a3dd','#dfba7d'][i%3]);colours.push(color.r,color.g,color.b);
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
        room.add(new THREE.Points(geometry,new THREE.PointsMaterial({vertexColors:true,size:.065,sizeAttenuation:true})));
    }
    function paintLED(state) {
        const tick=Math.floor((state.stageTime||0)*12);
        if(tick===lastLed && lastArtwork===state.artwork)return;
        lastLed=tick;lastArtwork=state.artwork;
        const ctx=ledContext,w=1024,h=512,t=(state.stageTime||0);
        const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#122743');gradient.addColorStop(.5,source.branding.accent);gradient.addColorStop(1,'#172753');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
        if(state.artwork) {
            const image=state.artwork,s=Math.max(w/image.naturalWidth,h/image.naturalHeight);
            ctx.drawImage(image,(w-image.naturalWidth*s)/2,(h-image.naturalHeight*s)/2,image.naturalWidth*s,image.naturalHeight*s);
            ctx.fillStyle='#070e2b88';ctx.fillRect(0,0,w,h);
        }
        for(let i=0;i<24;i++) {
            ctx.fillStyle=i%2?'#a0eaff33':'#ffffff18';
            const x=i*w/24,bar=40+(Math.sin(i*.9+t*1.5)+1)*65;
            ctx.fillRect(x,h-bar,w/32,bar);
        }
        ctx.textAlign='center';ctx.fillStyle='#d2f8ff';ctx.font='600 22px system-ui';ctx.fillText('T I C K S E C U R E   /   L I V E',w/2,140);
        const title=source.branding.title;let font=64;
        do {ctx.font=`700 ${font}px system-ui`;if(ctx.measureText(title).width<920)break;font-=2;}while(font>20);
        ctx.fillStyle='#ffffff';ctx.fillText(title,w/2,260);
        ctx.font='22px system-ui';ctx.fillStyle='#dce6ff';ctx.fillText('THE VIEW. THE MOMENT. THE EXPERIENCE.',w/2,312);
        ledTexture.needsUpdate=true;
    }
    function draw(next,state,view,width,height,audience=[]) {
        if(disposed)return;
        if(next!==source)build(next);
        const ratio=Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.5:2);
        if(width!==lastWidth||height!==lastHeight||renderer.getPixelRatio()!==ratio) {
            renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);lastWidth=width;lastHeight=height;
        }
        camera.position.fromArray(view.eye);camera.up.fromArray(view.up);
        camera.lookAt(new THREE.Vector3(...view.eye).add(new THREE.Vector3(...view.forward)));
        sky.position.copy(camera.position);
        camera.fov=THREE.MathUtils.radToDeg(view.fov);camera.aspect=width/height;camera.near=view.near;camera.far=Math.max(1000,source.radius*20);camera.updateProjectionMatrix();
        const signature=JSON.stringify([state.selected,state.focusId,state.hoverId,state.viewSeatId,source.seats.map(s=>s.status)]);
        if(signature!==lastState) {
            lastState=signature;const selected=new Set(state.selected||[]);
            source.seats.forEach((seat,index)=>{
                matrix.position.set(seat.x,0,seat.z);matrix.rotation.set(0,seat.angle,0);
                matrix.scale.setScalar(seat.id&&seat.id===state.viewSeatId?0:1);matrix.updateMatrix();
                const value=seat.status==='CONTEXT'?'#9da9b5':selected.has(seat.id)||seat.status==='HIGHLIGHTED'?'#3693e2':['AVAILABLE','MINE'].includes(seat.status)?'#3d8973':'#95a2a9';
                color.set(value);if(seat.id && seat.id===state.hoverId)color.lerp(new THREE.Color('#ffffff'),.22);
                for(const mesh of chairs){mesh.setMatrixAt(index,matrix.matrix);if(mesh.userData.coloured)mesh.setColorAt(index,color);}
            });
            for(const mesh of chairs){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
            renderer.shadowMap.needsUpdate=true;
        }
        room.visible=!!state.viewSeatId; // Keep overview focused on the actual uploaded plan.
        for (const {lamp,phase} of beams) {lamp.rotation.x=.25+Math.sin((state.stageTime||0)*.38+phase)*.3;lamp.rotation.z=Math.cos((state.stageTime||0)*.3+phase)*.25;}
        const indices=audience.filter(i=>source.seats[i]?.id!==state.viewSeatId).slice(0,320);
        for(let part=0;part<people.length;part++) {
            const mesh=people[part];mesh.count=indices.length;
            indices.forEach((index,i)=>{
                const seat=source.seats[index],time=state.peopleTime||0,bob=Math.sin(time*1.3+index)*.015;
                matrix.rotation.set(0,seat.angle,0);matrix.scale.setScalar(1);
                if(part<2)matrix.position.set(seat.x,(part?1.63:1.2)+bob,seat.z);
                else {
                    const sway=Math.sin(time*1.7+index*2.4)*.16;
                    const point=(x,y,z)=>new THREE.Vector3(seat.x+x*Math.cos(seat.angle)+z*Math.sin(seat.angle),y+bob,seat.z-x*Math.sin(seat.angle)+z*Math.cos(seat.angle));
                    const shoulder=point(.17,1.4,0),grip=point(.32+sway,1.85,.05);
                    if(part===3)matrix.position.copy(grip);
                    else {
                        const start=part===2?shoulder:grip,end=part===2?grip:point(.32+sway*1.9,2.48,.08);
                        const direction=end.clone().sub(start);
                        matrix.position.copy(start.clone().add(end).multiplyScalar(.5));matrix.scale.y=direction.length();
                        matrix.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
                    }
                    if(part>=4)mesh.setColorAt(i,color.set(['#79fff1','#ff86d9','#bc9aff','#ffe99a'][index%4]));
                }
                matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
            });mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        }
        paintLED(state);world.updateMatrixWorld(true);camera.updateMatrixWorld(true);renderer.render(world,camera);
    }
    function pick(x,y) {
        if(!source||disposed)return null;
        pointer.set(x/lastWidth*2-1,1-y/lastHeight*2);raycaster.setFromCamera(pointer,camera);
        const hit=raycaster.intersectObjects(pickables,false)[0];
        return hit?.object.userData.seatInstances ? source.seats[hit.instanceId]?.id || null : null;
    }
    return {canvas,draw,pick,
        stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,seats:source?.seats.length||0}),
        dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);clear();renderer.dispose();canvas.remove();}
    };
}

window.tsSeatWebGL = {create};
