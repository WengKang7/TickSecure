// A schematic 3D venue derived from the saved plan, never a surveyed sightline.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.tsSeatViewModel = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
    const median = values => { const v = values.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 1; };
    const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unit = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
    const validPosition = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 104 && p.y >= 0 && p.y <= 106;
    const pageOf = p => Number.isInteger(p?.page) && p.page > 0 ? p.page : 1;
    const pages = model => [...new Set((model.seats || []).filter(s => validPosition(s.position)).map(s => pageOf(s.position)))].sort((a, b) => a - b);

    function createScene(model, page = pages(model)[0]) {
        const geometry = model.geometry || {}, pageGeometry = geometry.pages?.[page] || (page === (geometry.page || 1) ? geometry : {});
        const imageWidth = Number(pageGeometry.imageWidth) || 104, imageHeight = Number(pageGeometry.imageHeight) || 106;
        const offered = (model.seats || []).filter(s => validPosition(s.position) && pageOf(s.position) === page);
        if (!offered.length) return null;
        const offeredLabels = new Set(offered.map(s => s.seatLabel));
        // Other physical chairs provide context only: they never acquire an event-seat ID.
        const context = (geometry.layoutSeats || []).filter(s => !offeredLabels.has(s.seatLabel) && validPosition(s.position) && pageOf(s.position) === page);
        const source = [...offered, ...context];
        const scale = 1 / median(source.map(s => (s.position.width || 2.8) / 104 * imageWidth));
        const depth = clamp(median(source.map(s => (s.position.height || 2.8) / 106 * imageHeight)) * scale, .7, 1.3);
        const point = p => [(p.x - 52) / 104 * imageWidth * scale, (p.y - 53) / 106 * imageHeight * scale];
        const seats = source.map((s, i) => { const [x, z] = point(s.position); return {
            id: i < offered.length ? s.id : null, label: String(s.seatLabel || ''), number: String(s.number || s.seatLabel || ''),
            status: i < offered.length ? s.status : 'CONTEXT', x, z, angle: 0
        }; });
        const xs = seats.map(s => s.x), zs = seats.map(s => s.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const middle = [(minX + maxX) / 2, (minZ + maxZ) / 2];
        const decoration = (pageGeometry.decorations || []).find(d => /^stage$/i.test(d.name || '') && d.points?.some(validPosition));
        const stagePoints = (decoration?.points || []).filter(validPosition).map(point);
        const picked = pageGeometry.stagePoint || pageGeometry.numbering?.stagePoint;
        const stageWidth = clamp(stagePoints.length ? Math.max(...stagePoints.map(p => p[0])) - Math.min(...stagePoints.map(p => p[0])) : 0, Math.max(4, (maxX - minX) * .5), Math.max(6, maxX - minX + 2));
        const stageDepth = clamp(stagePoints.length ? Math.max(...stagePoints.map(p => p[1])) - Math.min(...stagePoints.map(p => p[1])) : 3, 2, 6);
        let stageX = middle[0], stageZ = minZ - 5;
        if (validPosition(picked)) [stageX, stageZ] = point(picked);
        else if (stagePoints.length) { stageX = stagePoints.reduce((sum, p) => sum + p[0], 0) / stagePoints.length; stageZ = stagePoints.reduce((sum, p) => sum + p[1], 0) / stagePoints.length; }
        const stage = { x: stageX, z: stageZ, width: stageWidth, depth: stageDepth, height: .8, estimated: !stagePoints.length && !validPosition(picked) };
        stage.front = unit([middle[0] - stage.x, 0, middle[1] - stage.z]);
        stage.angle = Math.atan2(stage.front[0], stage.front[2]);
        seats.forEach(s => { s.angle = Math.atan2(stage.x - s.x, stage.z - s.z); });
        const extentX = Math.abs(Math.cos(stage.angle)) * stage.width / 2 + Math.abs(Math.sin(stage.angle)) * stage.depth / 2;
        const extentZ = Math.abs(Math.sin(stage.angle)) * stage.width / 2 + Math.abs(Math.cos(stage.angle)) * stage.depth / 2;
        const bounds = { minX: Math.min(minX - 2, stage.x - extentX - 2), maxX: Math.max(maxX + 2, stage.x + extentX + 2), minZ: Math.min(minZ - 2, stage.z - extentZ - 2), maxZ: Math.max(maxZ + 2, stage.z + extentZ + 2) };
        const center = [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2];
        const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2;
        return { page, seats, stage, depth, bounds, center, radius, meshes: buildMeshes(seats, stage, depth, bounds) };
    }

    // Presentation geometry only; saved seat centres and inventory IDs stay untouched.
    function buildMeshes(seats, stage, depth, bounds) {
        const faces = [], labels = [], shadows = [], chairFaces = [], distantFaces = [];
        function transform(x, y, z, cx, cz, angle) {
            const c = Math.cos(angle), s = Math.sin(angle);
            return [cx + x * c + z * s, y, cz - x * s + z * c];
        }
        function face(points, kind, seatIndex = -1, part = kind) {
            const normal = unit(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
            faces.push({ points, normal, center: points[0].map((_, i) => points.reduce((sum, p) => sum + p[i], 0) / points.length), kind, seatIndex, part });
        }
        function box(cx, cz, angle, x, y, z, w, h, d, kind, seatIndex = -1, part = kind) {
            const vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
                .map(v => transform(x + v[0] * w / 2, y + v[1] * h / 2, z + v[2] * d / 2, cx, cz, angle));
            [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2]].forEach(indices => {
                face(indices.map(i => vertices[i]), kind, seatIndex, part);
            });
        }
        // Rounded padded profiles are generated locally, without textures or downloads.
        function padded(seat, index, x, y, z, w, h, d, radius, part, horizontal = false) {
            const halfW = w / 2, halfH = (horizontal ? d : h) / 2, halfD = (horizontal ? h : d) / 2;
            const profile = [[halfW-radius,-halfH+radius,-Math.PI/2],[halfW-radius,halfH-radius,0],[-halfW+radius,halfH-radius,Math.PI/2],[-halfW+radius,-halfH+radius,Math.PI]]
                .flatMap(([cx,cy,start]) => Array.from({length:4},(_,i) => [cx+Math.cos(start+i*Math.PI/6)*radius,cy+Math.sin(start+i*Math.PI/6)*radius]));
            const count = profile.length;
            const vertices = [-halfD, halfD].flatMap(zFace => profile.map(([u,v]) => transform(x + u, y + (horizontal ? zFace : v), z + (horizontal ? -v : zFace), seat.x, seat.z, seat.angle)));
            face(vertices.slice(0, count).reverse(), 'chair', index, part);
            face(vertices.slice(count), 'chair', index, part);
            for (let i = 0; i < count; i++) { const next = (i + 1) % count; face([vertices[i],vertices[next],vertices[next + count],vertices[i + count]], 'chair', index, part); }
        }
        // A shallow plinth and restrained border give the plan a finished model base.
        box((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, 0, 0, -.22, 0,
            bounds.maxX - bounds.minX, .36, bounds.maxZ - bounds.minZ, 'floorBase');
        faces.push({ points: [[bounds.minX, -.04, bounds.minZ],[bounds.minX, -.04, bounds.maxZ],[bounds.maxX, -.04, bounds.maxZ],[bounds.maxX, -.04, bounds.minZ]], normal: [0,1,0], center: [0,-.04,0], kind: 'floor', seatIndex: -1 });
        seats.forEach((seat, index) => {
            const detailStart = faces.length;
            box(seat.x, seat.z, seat.angle, -.25, .27, 0, .08, .54, depth * .57, 'support', index, 'legs');
            box(seat.x, seat.z, seat.angle, .25, .27, 0, .08, .54, depth * .57, 'support', index, 'legs');
            padded(seat, index, 0, .61, .015, .78, .18, depth * .78, .08, 'cushion', true);
            padded(seat, index, 0, 1.04, -depth * .34, .86, .84, .19, .13, 'backrest');
            for (const side of [-1, 1]) box(seat.x, seat.z, seat.angle, side * .43, .81, .015, .09, .095, depth * .68, 'support', index, 'armrest');
            chairFaces.push(faces.slice(detailStart));
            const distantStart = faces.length;
            box(seat.x, seat.z, seat.angle, 0, 1.04, -depth*.34, .86, .84, .19, 'chair', index, 'backrest');
            box(seat.x, seat.z, seat.angle, 0, .61, .015, .78, .18, depth*.78, 'chair', index, 'cushion');
            distantFaces.push(faces.splice(distantStart));
            shadows.push({ seatIndex: index, points: Array.from({length:12},(_,i) => { const a=i/12*Math.PI*2; return transform(Math.cos(a)*.64+.045,-.025,Math.sin(a)*depth*.58+.06,seat.x,seat.z,seat.angle); }) });
            labels.push({ point: [seat.x, 1.65, seat.z], seatIndex: index });
        });
        box(stage.x, stage.z, stage.angle, 0, stage.height / 2, 0, stage.width, stage.height, stage.depth, 'stage');
        box(stage.x, stage.z, stage.angle, 0, stage.height + .025, 0, stage.width, .05, stage.depth, 'wood');
        box(stage.x, stage.z, stage.angle, 0, stage.height - .12, stage.depth / 2 + .015, stage.width * .96, .045, .03, 'light');
        box(stage.x, stage.z, stage.angle, 0, 2.35, -stage.depth / 2, stage.width, 3.1, .2, 'backdrop');
        const stagePoint = (x,y,z) => transform(x,y,z,stage.x,stage.z,stage.angle);
        const screenZ = -stage.depth / 2 + .105;
        face([stagePoint(-stage.width*.41,1.25,screenZ),stagePoint(stage.width*.41,1.25,screenZ),stagePoint(stage.width*.41,3.48,screenZ),stagePoint(-stage.width*.41,3.48,screenZ)], 'screen');
        // Decorative panel strips sit on the existing backdrop, never in the aisles.
        for (const side of [-1,1]) for (let i = 0; i < 3; i++) box(stage.x,stage.z,stage.angle,side * stage.width * (.435 + i * .022),2.35,screenZ+.02,stage.width*.008,2.7,.025,'trim');
        const title = stagePoint(0, 2.4, screenZ + .015);
        const stagePlanks = Array.from({length:Math.min(24,Math.ceil(stage.width/.7))},(_,i) => {
            const x = -stage.width/2 + (i+1)*stage.width/(Math.min(24,Math.ceil(stage.width/.7))+1);
            return [stagePoint(x,stage.height+.051,-stage.depth/2),stagePoint(x,stage.height+.051,stage.depth/2)];
        });
        return { faces, chairFaces, distantFaces, venueFaces: faces.filter(f => f.seatIndex < 0), labels, shadows, stagePlanks, stageLabel: title };
    }

    function overviewCamera(scene, aspect = 1, orbit = {}) {
        const yaw = (orbit.yaw || 0) + scene.stage.angle + .18, elevation = clamp(orbit.elevation ?? .78, .2, 1.35);
        const fov = .75;
        const atDistance = distance => camera([scene.center[0] + Math.sin(yaw) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, scene.center[2] + Math.cos(yaw) * Math.cos(elevation) * distance], scene.center, fov);
        // Fit the projected venue, not its bounding sphere, so wide plans fill the panel.
        const corners = [scene.bounds.minX, scene.bounds.maxX].flatMap(x => [scene.bounds.minZ, scene.bounds.maxZ].flatMap(z => [0, 3.9].map(y => [x,y,z])));
        let low = scene.radius * .5, high = scene.radius * 16 / Math.min(1, aspect);
        for (let i = 0; i < 20; i++) {
            const distance = (low + high) / 2, candidate = atDistance(distance);
            const fits = corners.every(point => { const p = project(point, candidate, aspect, 1); return p && p.x >= aspect * .05 && p.x <= aspect * .95 && p.y >= .06 && p.y <= .94; });
            if (fits) high = distance; else low = distance;
        }
        return atDistance(high * clamp(orbit.zoom || 1, .18, 2.5));
    }
    function seatCamera(scene, id, look = {}) {
        const seat = scene.seats.find(s => s.id === id);
        if (!seat) return null;
        const eye = [seat.x, 1.75, seat.z], toward = subtract([scene.stage.x, scene.stage.height + 1.4, scene.stage.z], eye);
        const yaw = Math.atan2(toward[0], toward[2]) + clamp(look.yaw || 0, -1.3, 1.3);
        const pitch = Math.atan2(toward[1], Math.hypot(toward[0], toward[2])) + clamp(look.pitch || 0, -.6, .6);
        return camera(eye, [eye[0] + Math.sin(yaw) * Math.cos(pitch), eye[1] + Math.sin(pitch), eye[2] + Math.cos(yaw) * Math.cos(pitch)], clamp(look.fov || 1.15, .65, 1.5));
    }
    function camera(eye, target, fov) {
        const forward = unit(subtract(target, eye)), right = unit(cross(forward, [0,1,0])), up = cross(right, forward);
        return { eye, forward, right, up, fov, near: .08 };
    }
    function cameraPoint(point, camera) {
        const x = point[0] - camera.eye[0], y = point[1] - camera.eye[1], z = point[2] - camera.eye[2];
        return [x * camera.right[0] + y * camera.right[1] + z * camera.right[2], x * camera.up[0] + y * camera.up[1] + z * camera.up[2], x * camera.forward[0] + y * camera.forward[1] + z * camera.forward[2]];
    }
    function screenPoint(point, camera, width, height) {
        const f = height / (2 * Math.tan(camera.fov / 2));
        return { x: width / 2 + point[0] / point[2] * f, y: height / 2 - point[1] / point[2] * f, depth: point[2] };
    }
    function project(point, camera, width, height) { const p = cameraPoint(point, camera); return p[2] < camera.near ? null : screenPoint(p, camera, width, height); }
    // Clip against the eye plane before projecting; seat-view polygons cannot flip across the screen.
    function clipNear(points, near) {
        const result = [];
        points.forEach((b, i) => {
            const a = points[(i + points.length - 1) % points.length], insideA = a[2] >= near, insideB = b[2] >= near;
            if (insideA !== insideB) { const t = (near - a[2]) / (b[2] - a[2]); result.push(a.map((v, j) => v + (b[j] - v) * t)); }
            if (insideB) result.push(b);
        });
        return result;
    }
    return { createScene, pages, validPosition, overviewCamera, seatCamera, project, cameraPoint, screenPoint, clipNear, dot, subtract, clamp };
});
