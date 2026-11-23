// Perspective canvas renderer. Audience motion runs only while enabled and visible.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./seat-view-model'), require('./seat-view-people'));
    else root.tsSeatView3D = factory(root.tsSeatViewModel, root.tsSeatViewPeople);
})(typeof window === 'object' ? window : globalThis, function (Model, People) {
    'use strict';
    const palette = { available: [61,137,115], selected: [54,147,226], unavailable: [149,162,169], context: [196,204,201],
        stage: [36,49,53], backdrop: [28,42,47], floor: [234,231,220], floorBase: [186,184,174], support: [55,68,68],
        wood: [48,53,61], trim: [103,127,142], light: [181,255,250], screen: [24,63,66],
        truss: [111,124,137], speaker: [27,32,40], speakerGrille: [61,70,80], woofer: [26,32,41], dustCap: [85,92,105] };
    const shade = (color, light) => `rgb(${color.map(v => Math.min(255, Math.round(v * light))).join(',')})`;
    const polygon = (ctx, points) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
    function roundedRect(ctx, x, y, w, h, radius) {
        const r = Math.min(radius, w / 2, h / 2);
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    const inside = (x, y, points) => {
        let yes = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i], b = points[j];
            if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) yes = !yes;
        }
        return yes;
    };

    // Decorative perimeter only: never adds seats, hit regions, or inventory IDs.
    function concertBackdrop(ctx, scene, camera, width, height, firstPerson) {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#070814'); sky.addColorStop(1, '#222035');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
        if (firstPerson) for (let i = 0; i < 85; i++) {
            ctx.fillStyle = i % 3 ? '#bab5dd70' : '#dcd8f5a0';
            ctx.fillRect((i * 173.17) % width, (i * 89.31) % (height * .38), 1, 1);
        }
        const project = points => Model.clipNear(points.map(p => Model.cameraPoint(p, camera)), camera.near).map(p => Model.screenPoint(p, camera, width, height));
        const cx = scene.center[0], cz = scene.center[2];
        const rx = (scene.bounds.maxX - scene.bounds.minX) * .76 + 7, rz = (scene.bounds.maxZ - scene.bounds.minZ) * .76 + 7;
        const scale = Math.min(rx, rz);
        const panels = [];
        for (let tier = 0; tier < 4; tier++) for (let i = 0; i < 64; i++) {
            const a = i / 64 * Math.PI * 2, b = (i + 1) / 64 * Math.PI * 2;
            const y = scale * (.035 + tier * .065);
            const points = [[cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz], [cx + Math.sin(b) * rx, y, cz + Math.cos(b) * rz],
                [cx + Math.sin(b) * rx, y + scale * .05, cz + Math.cos(b) * rz], [cx + Math.sin(a) * rx, y + scale * .05, cz + Math.cos(a) * rz]];
            const screen = project(points); if (screen.length < 3) continue;
            panels.push({ screen, tier, depth: screen.reduce((s, p) => s + p.depth, 0) / screen.length });
        }
        panels.sort((a, b) => b.depth - a.depth);
        for (const panel of panels) { polygon(ctx, panel.screen); ctx.fillStyle = panel.tier % 2 ? '#232032' : '#161622'; ctx.fill(); }
        // Light points suggest a distant audience without asserting real seat positions.
        for (let i = 0; i < 700; i++) {
            const a = i * 2.39996, y = scale * (.05 + (i % 17) * .012);
            const p = Model.project([cx + Math.sin(a) * (rx - .2), y, cz + Math.cos(a) * (rz - .2)], camera, width, height);
            if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue;
            ctx.fillStyle = ['#c7a1ff80', '#77cbdc80', '#e2bc7b80'][i % 3];
            ctx.fillRect(p.x, p.y, firstPerson ? 1.5 : 1, firstPerson ? 1.5 : 1);
        }
    }

    function screenArtwork(ctx, points, image) {
        if(!image || points.length!==4 || !image.naturalWidth || !image.naturalHeight)return;
        const q=[points[3],points[2],points[1],points[0]],w=image.naturalWidth,h=image.naturalHeight;
        for(const indices of [[0,1,2],[0,2,3]]) {
            const [a,b,c]=indices.map(i=>q[i]);ctx.save();polygon(ctx,[a,b,c]);ctx.clip();
            if(indices[1]===1)ctx.transform((b.x-a.x)/w,(b.y-a.y)/w,(c.x-b.x)/h,(c.y-b.y)/h,a.x,a.y);
            else ctx.transform((b.x-c.x)/w,(b.y-c.y)/w,(c.x-a.x)/h,(c.y-a.y)/h,a.x,a.y);
            ctx.drawImage(image,0,0);ctx.restore();
        }
        ctx.save();polygon(ctx,points);ctx.fillStyle='#08091965';ctx.fill();ctx.restore();
    }

    function miniMap(ctx,scene,state,camera,width,height) {
        const w=width<480?105:150,h=w*.75,x=width-w-12,y=height-h-48;
        const b=scene.bounds,scale=Math.min((w-22)/(b.maxX-b.minX||1),(h-30)/(b.maxZ-b.minZ||1));
        const map=point=>({x:x+w/2+(point[0]-scene.center[0])*scale,y:y+h/2+9+(point[2]-scene.center[2])*scale});
        ctx.save();ctx.fillStyle='#0c0e1bea';ctx.fillRect(x,y,w,h);ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillStyle='#cfc2e4';ctx.fillText('SEAT LOCATION',x+9,y+13);
        const selected=new Set(state.selected||[]);
        for(const seat of scene.seats){const p=map([seat.x,0,seat.z]);ctx.fillStyle=selected.has(seat.id)?'#74baff':seat.id&&['AVAILABLE','MINE'].includes(seat.status)?'#598b7c':'#777481';ctx.fillRect(p.x-1,p.y-1,2,2);}
        const stage=scene.stage,right=[stage.front[2],0,-stage.front[0]];
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>map([stage.x+right[0]*a*stage.width/2+stage.front[0]*b*stage.depth/2,0,stage.z+right[2]*a*stage.width/2+stage.front[2]*b*stage.depth/2]));
        polygon(ctx,corners);ctx.fillStyle='#bca0ec';ctx.fill();
        const focus=scene.seats.find(s=>s.id===(state.viewSeatId||state.focusId));
        if(focus){const p=map([focus.x,0,focus.z]),direction=state.viewSeatId?camera.forward:[stage.x-focus.x,0,stage.z-focus.z],length=Math.hypot(direction[0],direction[2])||1,dx=direction[0]/length,dy=direction[2]/length;
            polygon(ctx,[{x:p.x+dx*12,y:p.y+dy*12},{x:p.x-dy*4,y:p.y+dx*4},{x:p.x+dy*4,y:p.y-dx*4}]);ctx.fillStyle='#f6d28a';ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(p.x-2,p.y-2,4,4);
        }
        ctx.restore();
        return {id:null,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]};
    }

    function draw(ctx, scene, state, width, height, audienceIndices = People?.seatIndices(scene, state) || []) {
        const selected = new Set(state.selected || []), firstPerson = !!state.viewSeatId;
        const camera = state.camera || (firstPerson ? Model.seatCamera(scene, state.viewSeatId, state.look) : Model.overviewCamera(scene, width / height, state.orbit));
        if (!camera) return [];
        ctx.clearRect(0, 0, width, height);
        if (state.whiteBackground) ctx.fillStyle = '#ffffff';
        else {
            const sky = ctx.createLinearGradient(0, 0, 0, height);
            sky.addColorStop(0, firstPerson ? '#172239' : '#ffffff');
            sky.addColorStop(.6, firstPerson ? '#526277' : '#fbfcfd');
            sky.addColorStop(1, firstPerson ? '#95989f' : '#eff3f5');
            ctx.fillStyle = sky;
        }
        ctx.fillRect(0, 0, width, height);
        if (state.concertTheme) concertBackdrop(ctx, scene, camera, width, height, firstPerson);
        const projected = [], hits = [], focal = height / (2 * Math.tan(camera.fov / 2));
        const projectPolygon = points => Model.clipNear(points.map(p => Model.cameraPoint(p, camera)), camera.near).map(p => Model.screenPoint(p, camera, width, height));
        const panelDepth = Model.cameraPoint([scene.stage.x + scene.stage.front[0] * (-scene.stage.depth / 2 + .1), scene.stage.screenY || 2.35,
            scene.stage.z + scene.stage.front[2] * (-scene.stage.depth / 2 + .1)], camera)[2];
        const seatSizes = scene.seats.map(seat => {
            const p = Model.cameraPoint([seat.x, .8, seat.z], camera);
            if (p[2] < -1.5) return 0;
            const size = focal / Math.max(.08, p[2]), screen = Model.screenPoint(p, camera, width, height);
            if (p[2] > 2 && (screen.x < -size * 2 || screen.x > width + size * 2 || screen.y < -size * 2 || screen.y > height + size * 2)) return 0;
            return size;
        });
        // Choose whole mesh groups before projecting, so large venues stay responsive.
        const audience = new Set(audienceIndices);
        const groups = [scene.meshes.venueFaces, ...scene.seats.map((seat,i) =>
            !seatSizes[i] || seat.id && seat.id === state.viewSeatId ? [] : seatSizes[i] < 14 ? scene.meshes.distantFaces[i] : scene.meshes.chairFaces[i])];
        if (audience.size) groups.push(People.buildFaces(scene, [...audience], state.peopleTime || 0, seatSizes));
        for (const group of groups) for (const face of group) {
            const seat = scene.seats[face.seatIndex];
            if (seat?.id && seat.id === state.viewSeatId) continue;
            // Keep all chairs pickable, but omit small hardware at distant zoom levels.
            if (seat && face.kind !== 'person' && (!seatSizes[face.seatIndex] || seatSizes[face.seatIndex] < 7 && face.part !== 'backrest' || seatSizes[face.seatIndex] < 24 && face.kind === 'support')) continue;
            if (Model.dot(face.normal, Model.subtract(camera.eye, face.center)) <= 0) continue;
            const points = projectPolygon(face.points);
            if (points.length < 3 || points.every(p => p.x < 0) || points.every(p => p.x > width) || points.every(p => p.y < 0) || points.every(p => p.y > height)) continue;
            let depth = points.reduce((sum, p) => sum + p.depth, 0) / points.length;
            // Coplanar backdrop decorations share the panel's depth, preventing the
            // wide panel from painting over its own trim when the camera rotates.
            if (face.kind === 'backdrop' && Model.dot(face.normal,scene.stage.front) > .99) depth = panelDepth + .002;
            if (face.kind === 'screen') depth = panelDepth + .001;
            if (face.kind === 'trim') depth = panelDepth;
            projected.push({ face, points, depth: face.kind === 'floor' || face.kind === 'floorBase' ? Infinity : depth });
        }
        // Draw a soft silhouette under the model; it never participates in picking.
        if (!firstPerson) {
            const base = projected.find(item => item.face.kind === 'floor');
            if (base) { ctx.save(); polygon(ctx, base.points.map(p => ({ x: p.x + 5, y: p.y + 10 }))); ctx.shadowColor = '#203c3430'; ctx.shadowBlur = 24; ctx.fillStyle = '#203c3415'; ctx.fill(); ctx.restore(); }
        }
        projected.sort((a, b) => b.depth - a.depth);
        for (const item of projected) {
            const { face, points } = item, seat = scene.seats[face.seatIndex];
            let color = face.color || palette[face.kind] || palette.available;
            if (face.kind === 'chair') color = seat.status === 'CONTEXT' ? palette.context : seat.status === 'HIGHLIGHTED' || selected.has(seat.id) ? palette.selected : ['AVAILABLE','MINE'].includes(seat.status) ? palette.available : palette.unavailable;
            const light = .69 + Math.max(0, Model.dot(face.normal, [-.38,.83,.4])) * .38;
            polygon(ctx, points);
            if (face.kind === 'screen') {
                const ys = points.map(p => p.y), glow = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
                glow.addColorStop(0, state.concertTheme ? scene.branding.accent : '#10243b'); glow.addColorStop(.5, state.concertTheme ? '#4c3976' : '#20555e'); glow.addColorStop(1, state.concertTheme ? '#17243c' : '#101e30'); ctx.fillStyle = glow;
            } else if (face.kind === 'floor') {
                const surface = ctx.createLinearGradient(0, 0, width, height); surface.addColorStop(0, state.concertTheme ? '#24283b' : firstPerson ? '#f1eee4' : '#f4f6f7'); surface.addColorStop(1, state.concertTheme ? '#111522' : firstPerson ? '#dddcd0' : '#d6dee2'); ctx.fillStyle = surface;
            } else if (face.kind === 'chair' && face.points.length > 4 && seatSizes[face.seatIndex] >= 20) {
                const ys = points.map(p => p.y), fabric = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
                fabric.addColorStop(0, shade(color, light * 1.24)); fabric.addColorStop(.18, shade(color, light * 1.04)); fabric.addColorStop(1, shade(color, light * .79)); ctx.fillStyle = fabric;
            } else ctx.fillStyle = shade(color, face.kind === 'light' || face.part === 'glow-stick' ? 1 : light);
            const luminous = face.part === 'glow-stick' || face.kind === 'light';
            if (luminous) { ctx.save(); ctx.shadowColor = '#83fff0'; ctx.shadowBlur = firstPerson ? 10 : 5; }
            ctx.fill();
            if (luminous) ctx.restore();
            ctx.strokeStyle = shade(color, light * .97); ctx.lineWidth = .45; ctx.lineJoin = 'round'; ctx.stroke();
            if (face.kind === 'chair' && face.points.length > 4 && seatSizes[face.seatIndex] >= 35) {
                const seam = projectPolygon(face.points.map(p => p.map((v,i) => face.center[i]+(v-face.center[i])*.88)));
                polygon(ctx, seam); ctx.strokeStyle = shade(color, light * 1.12); ctx.lineWidth = .7; ctx.stroke();
            }
            if (face.kind === 'wood' && face.normal[1] > .9) {
                ctx.save(); polygon(ctx,points); ctx.clip(); ctx.strokeStyle = '#5d432324'; ctx.lineWidth = .7;
                for (const plank of scene.meshes.stagePlanks) {
                    const [a,b] = plank.map(p => Model.project(p,camera,width,height));
                    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
                }
                ctx.restore();
            }
            if (face.kind === 'floor') {
                // Subtle floor joints and layered contact shadows anchor each chair.
                ctx.save(); polygon(ctx, points); ctx.clip(); ctx.strokeStyle = '#b7b9ac28'; ctx.lineWidth = .65;
                const { minX, maxX, minZ, maxZ } = scene.bounds;
                const spacing = Math.max(4, (maxX - minX) / 18, (maxZ - minZ) / 18);
                for (let z = minZ + spacing; z < maxZ; z += spacing) {
                    const a = Model.project([minX,-.035,z],camera,width,height), b = Model.project([maxX,-.035,z],camera,width,height);
                    if (a && b) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
                }
                for (const shadow of scene.meshes.shadows) {
                    if (seatSizes[shadow.seatIndex] < 7) continue;
                    const ground = projectPolygon(shadow.points); if (ground.length < 3) continue;
                    polygon(ctx, ground); ctx.fillStyle = '#20372d12'; ctx.fill();
                    const seat = scene.seats[shadow.seatIndex];
                    polygon(ctx, projectPolygon(shadow.points.map(p => [seat.x+(p[0]-seat.x)*.73,p[1],seat.z+(p[2]-seat.z)*.73]))); ctx.fillStyle = '#20372d13'; ctx.fill();
                }
                if (!firstPerson) for (const seat of scene.seats) {
                    if (!seat.id || !selected.has(seat.id) && seat.id !== state.focusId) continue;
                    const ring = projectPolygon(Array.from({length:24},(_,i) => { const a=i/24*Math.PI*2; return [seat.x+Math.cos(a)*.7,-.02,seat.z+Math.sin(a)*scene.depth*.66]; }));
                    if (ring.length < 3) continue;
                    polygon(ctx, ring); ctx.fillStyle = selected.has(seat.id) ? '#368fe329' : '#bd965926'; ctx.fill();
                    ctx.strokeStyle = selected.has(seat.id) ? '#348bd5' : '#b38a49'; ctx.lineWidth = 1.6; ctx.stroke();
                }
                ctx.restore();
            }
            if (face.kind === 'screen') {
                const p = Model.project(state.concertTheme ? face.center : scene.meshes.stageLabel, camera, width, height);
                if (p) {
                    ctx.save(); polygon(ctx, points); ctx.clip();
                    if(state.concertTheme && state.artwork && face.points.every(point=>Model.cameraPoint(point,camera)[2]>=camera.near))screenArtwork(ctx,points,state.artwork);
                    for (const [index,bar] of scene.meshes.screenBars.entries()) {
                        const pulse = state.concertTheme ? .65+.35*Math.sin((state.stageTime||0)*1.7+index*.6)**2 : 1;
                        const centerY=bar.reduce((sum,v)=>sum+v[1],0)/bar.length;
                        const visible = projectPolygon(bar.map(v=>[v[0],centerY+(v[1]-centerY)*pulse,v[2]]));
                        if (visible.length < 3) continue;
                        polygon(ctx, visible);
                        ctx.fillStyle = '#81e7d69c';
                        ctx.fill();
                    }
                    const screenHeight = Math.max(...points.map(v => v.y)) - Math.min(...points.map(v => v.y));
                    const screenWidth = Math.max(...points.map(v => v.x))-Math.min(...points.map(v => v.x));
                    let size = Math.min(Model.clamp(focal / p.depth * scene.stage.width / 11, 9, 30), screenHeight * .4, state.concertTheme ? screenWidth / 5 : Infinity);
                    const mainScreen = Math.hypot(face.center[0]-scene.meshes.stageLabel[0],face.center[2]-scene.meshes.stageLabel[2])<scene.stage.width*.2;
                    const title=state.concertTheme ? mainScreen ? scene.branding.title : 'LIVE' : 'STAGE';
                    ctx.font = `600 ${size}px system-ui, sans-serif`;
                    if(state.concertTheme){const measured=ctx.measureText(title).width;if(measured>screenWidth*.84)size*=screenWidth*.84/measured;ctx.font=`600 ${size}px system-ui, sans-serif`;}
                    ctx.fillStyle = '#f4f2e7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(title, p.x, p.y);
                    if (state.concertTheme && size > 8) { ctx.font = `500 ${Math.max(5,size*.3)}px system-ui, sans-serif`; ctx.fillText('T I C K S E C U R E',p.x,p.y+size*.8); }
                    if (size > 15) { ctx.fillStyle = '#d5b47c'; ctx.fillRect(p.x-size*.7,p.y+size*.8,size*1.4,1.5); }
                    ctx.restore();
                }
            }
            // Include the stage and contextual chairs as occluders in picking.
            if (!firstPerson && face.kind !== 'floor' && face.kind !== 'floorBase') hits.push({ id: seat?.id || null, points });
        }
        if (state.concertTheme) {
            const stage = scene.stage, front = stage.front, right = [front[2], 0, -front[0]];
            for (let i = 0; i < 5; i++) {
                const side = (i / 4 - .5) * stage.width;
                const apex = [stage.x + right[0] * side, stage.visualHeight || 4.4, stage.z + right[2] * side];
                const reach = Math.min(scene.radius * .4, 12), spread = stage.width * .13;
                const sweep=Math.sin((state.stageTime||0)*.45+i*.9)*stage.width*.12;
                const end = [apex[0] + front[0] * reach+right[0]*sweep, .1, apex[2] + front[2] * reach+right[2]*sweep];
                const beam = projectPolygon([apex, [end[0] - right[0] * spread, end[1], end[2] - right[2] * spread],
                    [end[0] + right[0] * spread, end[1], end[2] + right[2] * spread]]);
                if (beam.length < 3) continue;
                ctx.save(); polygon(ctx, beam); ctx.fillStyle = ['#c69aff13', '#7bdded13', '#f5cf7e13'][i % 3]; ctx.fill(); ctx.restore();
            }
        }
        if (!firstPerson) {
            const activeSeat = seat => selected.has(seat.id) || seat.id === state.focusId || seat.id === state.hoverId;
            const occupied = [];
            for (const item of [...scene.meshes.labels].sort((a, b) => Number(activeSeat(scene.seats[b.seatIndex])) - Number(activeSeat(scene.seats[a.seatIndex])))) {
                const seat = scene.seats[item.seatIndex];
                if (!seat.id) continue;
                const p = Model.project(audience.has(item.seatIndex) ? [item.point[0],2.15,item.point[2]] : item.point, camera, width, height);
                if (!p || p.x < 10 || p.x > width - 10 || p.y < 10 || p.y > height - 10) continue;
                const size = height / (2 * Math.tan(camera.fov / 2)) / p.depth;
                const active = activeSeat(seat);
                if (size < 27 && !active) continue;
                // A compact badge labels the chair without adding a DOM node per seat.
                ctx.font = `${active ? 700 : 500} ${active ? 11 : 10}px system-ui, sans-serif`;
                const checked = selected.has(seat.id);
                const detectedNumber = /^DETECTED_SEATS[-_](\d+)$/i.exec(seat.label);
                const fullLabel = active ? (detectedNumber ? 'Seat ' + detectedNumber[1] : seat.label) : seat.number;
                // Full identifiers remain in the tooltip and seat list; badges fit mobile.
                let label = fullLabel;
                const maxLabelWidth = Math.min(180, width - 52);
                while (label.length > 1 && ctx.measureText(label).width > maxLabelWidth) label = label.slice(0,-2) + '\u2026';
                const textWidth = ctx.measureText(label).width;
                if (!active && textWidth + 10 > size) continue;
                const badgeHeight = active ? 24 : 17, badgeWidth = textWidth + (active ? 16 : 10) + (checked ? 13 : 0);
                const box = { x: Model.clamp(p.x - badgeWidth / 2, 6, width - badgeWidth - 6), y: Model.clamp(p.y - badgeHeight / 2 - (active ? 15 : 0), 2, height - badgeHeight - 2), w: badgeWidth, h: badgeHeight };
                if (occupied.some(other => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y)) continue;
                occupied.push(box);
                const labelY = box.y + box.h / 2;
                if (active && box.y + box.h < p.y) {
                    ctx.beginPath(); ctx.moveTo(p.x, box.y + box.h); ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = '#24535c'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                roundedRect(ctx, box.x, box.y, box.w, box.h, active ? 7 : 4);
                ctx.fillStyle = active ? selected.has(seat.id) ? '#246eaf' : '#263d36' : '#fffffff0'; ctx.fill();
                ctx.strokeStyle = active ? '#ffffff' : '#c6d1c8'; ctx.lineWidth = active ? 1.4 : .6; ctx.stroke();
                if (checked) { ctx.beginPath(); ctx.moveTo(box.x+8,labelY); ctx.lineTo(box.x+11,labelY+3); ctx.lineTo(box.x+16,labelY-3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
                ctx.fillStyle = active ? '#ffffff' : '#3e5950'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, box.x + box.w / 2 + (checked ? 6.5 : 0), labelY);
                hits.push({ id: seat.id, points: [{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h}] });
            }
        }
        if(state.minimap) { const mask=miniMap(ctx,scene,state,camera,width,height); if(!firstPerson)hits.push(mask); }
        return hits;
    }
    function hitTest(hits, x, y) { for (let i = hits.length - 1; i >= 0; i--) if (inside(x, y, hits[i].points)) return hits[i].id; return null; }

    function mount(container, options = {}) {
        const canvas = document.createElement('canvas');
        let ctx; try { ctx = canvas.getContext('2d'); } catch (_) { return null; }
        if (!ctx || !Model) return null;
        canvas.className = 'ts-seat-3d-canvas'; canvas.tabIndex = 0;
        canvas.setAttribute('role', 'group');
        canvas.setAttribute('aria-label', '3D seats. Drag to rotate. Arrow keys browse seats, Enter selects, V views the stage, Escape returns to overview.');
        const tooltip = document.createElement('div'); tooltip.className = 'ts-seat-3d-tooltip'; tooltip.hidden = true; tooltip.setAttribute('aria-hidden', 'true');
        const hint = document.createElement('div'); hint.className = 'ts-seat-3d-hint'; hint.setAttribute('aria-hidden', 'true');
        container.replaceChildren(canvas, tooltip, hint);
        let model, scene, page, frame = 0, disposed = false, hits = [], drag = null, width = 0, height = 0;
        const state = { selected: [], focusId: null, hoverId: null, viewSeatId: null, orbit: {}, look: {}, showPeople: false, peopleMotion: true, peopleTime: 0, stageTime:0, stageMotion:true, camera:null,
            whiteBackground: options.whiteBackground === true, concertTheme: options.concertTheme === true, minimap:options.concertTheme === true, artwork:null };
        const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        let reducedMotion = !!motionPreference?.matches, inViewport = true, dirty = true, lastTime = null, lastPaint = -Infinity;
        let busy = false;
        let transition = null;
        let artworkKey='', artworkVersion=0, pendingImage=null;
        function loadArtwork(next) {
            const urls=[next?.bannerUrl,next?.posterUrl].filter(value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com';}catch(_){return false;}});
            const key=urls.join('|');if(key===artworkKey)return;artworkKey=key;state.artwork=null;
            const version=++artworkVersion;
            if(pendingImage){pendingImage.onload=pendingImage.onerror=null;pendingImage=null;}
            if(!state.concertTheme || typeof window.Image!=='function')return;
            function attempt(index){if(disposed||version!==artworkVersion||!urls[index])return;
                const image=new window.Image();pendingImage=image;image.crossOrigin='anonymous';
                image.onload=()=>{if(disposed||version!==artworkVersion)return;state.artwork=image;pendingImage=null;schedule();};
                image.onerror=()=>{if(version===artworkVersion)attempt(index+1);};image.src=urls[index];
            }attempt(0);
        }
        const targetCamera = () => !scene ? null : state.viewSeatId ? Model.seatCamera(scene,state.viewSeatId,state.look) : Model.overviewCamera(scene,width/height||1,state.orbit);
        const startTransition = from => { transition = state.concertTheme && from && !reducedMotion ? {from,start:null} : null; state.camera=null; };
        const listeners = [];
        function listen(target, name, fn, opts) { target.addEventListener(name, fn, opts); listeners.push(() => target.removeEventListener(name, fn, opts)); }
        function stopMotion() { if (frame) window.cancelAnimationFrame(frame); frame = 0; lastTime = null; }
        function paint(timestamp = 0) {
            frame = 0;
            if (disposed || !scene || container.hidden || document.hidden || !inViewport) { lastTime = null; return; }
            const audienceIndices = People?.seatIndices(scene, state) || [];
            const peopleAnimate = audienceIndices.length > 0 && state.peopleMotion && !reducedMotion;
            const stageAnimate = state.concertTheme && state.stageMotion && !reducedMotion;
            const animate = peopleAnimate || stageAnimate || !!transition;
            // Twelve frames per second is enough for breathing and gentle head turns.
            if (animate && !dirty && timestamp - lastPaint < 1000 / (transition ? 30 : 12)) { schedule(false); return; }
            const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
            if (width < 1 || height < 1) { lastTime = null; return; }
            const elapsed=lastTime===null?0:Math.max(0,Math.min(timestamp-lastTime,200))/1000;
            if (peopleAnimate) state.peopleTime += elapsed;
            if (stageAnimate) state.stageTime += elapsed;
            if(transition){
                if(transition.start===null)transition.start=timestamp;
                const progress=Model.clamp((timestamp-transition.start)/700,0,1), eased=progress*progress*(3-2*progress);
                state.camera=Model.blendCamera(transition.from,targetCamera(),eased);
                if(progress===1){transition=null;state.camera=null;}
            }
            lastTime = animate ? timestamp : null; lastPaint = timestamp; dirty = false;
            const ratio = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(width * ratio), h = Math.round(height * ratio);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            hits = draw(ctx, scene, state, width, height, audienceIndices);
            if (animate) schedule(false);
        }
        function schedule(invalidate = true) { if (invalidate) dirty = true; if (!frame && !disposed) frame = window.requestAnimationFrame(paint); }
        function info() {
            hint.textContent = state.viewSeatId ? 'Drag to look around \u00b7 Esc for overview' : 'Drag to rotate \u00b7 + / \u2212 to zoom';
            options.onViewChange?.({ viewSeatId: state.viewSeatId, page, pages: model ? Model.pages(model) : [], estimatedStage: scene?.stage.estimated,
                peopleAvailable: !!People, showPeople: state.showPeople, peopleMotion: state.peopleMotion && !reducedMotion, stageMotion:state.stageMotion && !reducedMotion, reducedMotion });
        }
        function focus(id) { state.focusId = id; options.onFocus?.(id); schedule(); }
        function overview() { const from=state.camera||targetCamera(); state.viewSeatId = null; state.hoverId = null; state.look = {}; startTransition(from); tooltip.hidden = true; info(); schedule(); }
        function viewFrom(id) {
            const seat = model?.seats.find(s => s.id === id && Model.validPosition(s.position));
            if (!seat) return false;
            const seatPage = seat.position.page || 1;
            const from=state.camera||targetCamera();
            if (page !== seatPage) { page = seatPage; scene = Model.createScene(model, page, options); state.orbit = {}; }
            state.viewSeatId = id; state.showPeople = !!People; state.hoverId = null; state.look = {}; state.focusId = id; startTransition(from); tooltip.hidden = true; options.onFocus?.(id); info(); schedule(); return true;
        }
        function zoom(factor) {
            transition=null;state.camera=null;
            if (state.viewSeatId) state.look.fov = Model.clamp((state.look.fov || 1.15) * factor, .65, 1.5);
            else state.orbit.zoom = Model.clamp((state.orbit.zoom || 1) * factor, .18, 2.5);
            schedule();
        }
        const locate = event => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
        listen(canvas, 'pointerdown', event => {
            if (event.button !== 0 || drag) return;
            const interrupted = !!transition;
            transition=null;state.camera=null;
            drag = { pointerId: event.pointerId, start: locate(event), last: locate(event), moved: false, interrupted };
            if(interrupted)schedule();
            canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); tooltip.hidden = true;
            if (state.hoverId) { state.hoverId = null; schedule(); }
        });
        listen(canvas, 'pointermove', event => {
            const p = locate(event);
            if (drag) {
                if (drag.pointerId !== event.pointerId) return;
                if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 6) drag.moved = true;
                if (drag.moved) {
                    const dx = (p.x - drag.last.x) * .008, dy = (p.y - drag.last.y) * .006;
                    if (state.viewSeatId) { state.look.yaw = Model.clamp((state.look.yaw || 0) - dx, -1.3, 1.3); state.look.pitch = Model.clamp((state.look.pitch || 0) + dy, -.6, .6); }
                    else { state.orbit.yaw = (state.orbit.yaw || 0) - dx; state.orbit.elevation = Model.clamp((state.orbit.elevation ?? 1.02) + dy, .2, 1.35); }
                    schedule();
                }
                drag.last = p; return;
            }
            const id = state.viewSeatId ? null : hitTest(hits, p.x, p.y), seat = scene?.seats.find(s => s.id === id && id);
            if (state.hoverId !== id) { state.hoverId = id; schedule(); }
            tooltip.hidden = !seat;
            if (seat) { tooltip.textContent = `${seat.label} · ${seat.status === 'MINE' ? 'Held by you' : seat.status.toLowerCase()}`; tooltip.style.left = `${Model.clamp(p.x, 90, width - 90)}px`; tooltip.style.top = `${Math.max(12, p.y - 42)}px`; }
            canvas.style.cursor = seat ? 'pointer' : 'grab';
        });
        function end(event, cancel = false) {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const moved = drag.moved || drag.interrupted; drag = null;
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            if (!cancel && !moved && !state.viewSeatId && !transition) { const p = locate(event), id = hitTest(hits, p.x, p.y); if (id) { focus(id); if (!busy) options.onSeatSelect?.(id); } }
        }
        listen(canvas, 'pointerup', event => end(event));
        listen(canvas, 'pointercancel', event => end(event, true));
        listen(canvas, 'lostpointercapture', () => { drag = null; });
        listen(canvas, 'pointerleave', () => { tooltip.hidden = true; if (state.hoverId) { state.hoverId = null; schedule(); } });
        // Scrolling the page remains normal; zoom uses the explicit + / − controls.
        listen(canvas, 'keydown', event => {
            if (!scene) return;
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
                transition=null;state.camera=null;
                event.preventDefault();
                if (state.viewSeatId) {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') state.look.yaw = Model.clamp((state.look.yaw || 0) + (event.key === 'ArrowLeft' ? .12 : -.12), -1.3, 1.3);
                    else state.look.pitch = Model.clamp((state.look.pitch || 0) + (event.key === 'ArrowUp' ? .1 : -.1), -.6, .6);
                    schedule(); return;
                }
                const seats = scene.seats.filter(s => s.id).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
                const current = seats.findIndex(s => s.id === state.focusId), step = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
                const next = current < 0 ? step > 0 ? 0 : seats.length - 1 : (current + step + seats.length) % seats.length;
                focus(seats[next]?.id);
            } else if ((event.key === 'Enter' || event.key === ' ') && state.focusId && !state.viewSeatId) { event.preventDefault(); if (!busy && !transition) options.onSeatSelect?.(state.focusId); }
            else if (event.key.toLowerCase() === 'v' && state.focusId) { event.preventDefault(); viewFrom(state.focusId); }
            else if (event.key === 'Escape' || event.key === 'Home') { event.preventDefault(); state.orbit = {}; overview(); }
            else if (event.key === '+' || event.key === '-') { event.preventDefault(); zoom(event.key === '+' ? .8 : 1.25); }
        });
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        resize?.observe(container); listen(window, 'resize', schedule);
        const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
            inViewport = entries.some(entry => entry.isIntersecting);
            if (inViewport) schedule(); else stopMotion();
        }) : null;
        visibility?.observe(container);
        if (document.addEventListener) listen(document, 'visibilitychange', () => { if (document.hidden) stopMotion(); else schedule(); });
        if (motionPreference?.addEventListener) listen(motionPreference, 'change', event => {
            reducedMotion = event.matches; transition=null;state.camera=null; stopMotion(); info(); schedule();
        });
        return {
            setStageMotion(enabled) { state.stageMotion=!!enabled; stopMotion(); info(); schedule(); },
            setPeople(enabled) { state.showPeople = !!People && !!enabled; stopMotion(); info(); schedule(); },
            setPeopleMotion(enabled) { state.peopleMotion = !!enabled; stopMotion(); info(); schedule(); },
            setVisible(visible) { if (!visible) stopMotion(); else schedule(); },
            update(next, selected = [], disabled = false) {
                busy = disabled; state.selected = selected;
                if (next !== model) {
                    transition=null;state.camera=null;
                    model = next;
                    loadArtwork(model);
                    if (!Model.pages(model).includes(page)) page = Model.pages(model)[0];
                    scene = Model.createScene(model, page, options);
                    if (state.viewSeatId && !scene?.seats.some(s => s.id === state.viewSeatId)) state.viewSeatId = null;
                    info();
                } else if (scene) { const status = new Map(model.seats.map(s => [s.id, s.status])); scene.seats.forEach(s => { if (s.id) s.status = status.get(s.id) || 'BLOCKED'; }); }
                schedule();
            },
            setPage(value) { if (!Model.pages(model).includes(Number(value))) return; page = Number(value); scene = Model.createScene(model, page, options); state.orbit = {}; state.focusId = null; options.onFocus?.(null); overview(); },
            focus, viewFrom, overview, zoom, resize: schedule,
            reset() { state.orbit = {}; state.focusId = null; options.onFocus?.(null); overview(); },
            dispose() { disposed = true; artworkVersion++;if(pendingImage)pendingImage.onload=pendingImage.onerror=null;state.artwork=null; stopMotion(); resize?.disconnect(); visibility?.disconnect(); listeners.forEach(remove => remove()); container.replaceChildren(); }
        };
    }
    return { mount, draw, hitTest };
});
