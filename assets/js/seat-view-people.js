// Optional, illustrative audience. No attendee data, inventory changes or network assets.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.tsSeatViewPeople = factory();
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const shirts = [[90,111,142],[178,135,96],[129,91,106],[108,136,129],[194,183,157],[94,106,122]];
    const skins = [[204,153,115],[153,104,75],[229,181,142],[115,77,57],[182,130,94]];
    const hair = [[53,43,38],[81,61,46],[41,38,37],[112,85,58]];
    const trousers = [[56,67,80],[74,77,76],[77,86,103]];
    const sub = (a,b) => a.map((v,i) => v-b[i]);
    const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const unit = a => { const size=Math.hypot(...a)||1; return a.map(v=>v/size); };
    function seed(label) { let value=2166136261; for (const c of String(label)) value=Math.imul(value^c.charCodeAt(0),16777619); return value>>>0; }

    function seatIndices(scene, state = {}) {
        if (!state.showPeople) return [];
        const excluded = new Set(state.selected || []);
        if (state.viewSeatId) excluded.add(state.viewSeatId);
        const candidates = scene.seats.map((seat,index) => ({seat,index})).filter(({seat}) => !seat.id || !excluded.has(seat.id));
        const anchor = scene.seats.find(s => s.id && s.id === (state.viewSeatId || state.focusId));
        // Neighbours are always included; larger overviews use a bounded sample.
        if (anchor) candidates.sort((a,b) => Math.hypot(a.seat.x-anchor.x,a.seat.z-anchor.z)-Math.hypot(b.seat.x-anchor.x,b.seat.z-anchor.z));
        const limit = state.viewSeatId ? 32 : 72;
        if (anchor || candidates.length <= limit) return candidates.slice(0,limit).map(s=>s.index);
        return Array.from({length:limit},(_,i) => candidates[Math.floor(i*candidates.length/limit)].index);
    }

    function buildFaces(scene, indices, time = 0, sizes = []) {
        const faces = [];
        for (const seatIndex of indices) {
            if (sizes.length && sizes[seatIndex] < 4) continue;
            const seat=scene.seats[seatIndex], key=seed(seat.label), phase=(key%628)/100;
            const t=Number.isFinite(time)?time:0, sway=Math.sin(t*1.3+phase)*.018, breath=Math.sin(t*1.8+phase)*.009;
            const turn=Math.sin(t*.8+phase)*.09, nod=Math.sin(t*1.1+phase)*.012;
            const c=Math.cos(seat.angle), s=Math.sin(seat.angle), low=sizes.length && sizes[seatIndex]<45;
            const skin=skins[key%skins.length], shirt=shirts[(key>>>3)%shirts.length], pants=trousers[(key>>>5)%trousers.length];
            function world(p) { return [seat.x+p[0]*c+p[2]*s,p[1],seat.z-p[0]*s+p[2]*c]; }
            function face(local, color, part) {
                const points=local.map(world), normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
                if (Math.hypot(...normal)<.1) return;
                faces.push({points,normal,center:points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length),
                    kind:'person',part,color,seatIndex});
            }
            function ellipsoid(center, radius, color, part, yaw=0) {
                const sides=low?6:8, rings=low?3:5, points=[];
                for(let row=0;row<=rings;row++) {
                    const latitude=-Math.PI/2+row*Math.PI/rings;
                    points.push(Array.from({length:sides},(_,i)=>{
                        const longitude=i*Math.PI*2/sides, x=Math.cos(longitude)*Math.cos(latitude)*radius[0], z=Math.sin(longitude)*Math.cos(latitude)*radius[2];
                        return [center[0]+x*Math.cos(yaw)+z*Math.sin(yaw),center[1]+Math.sin(latitude)*radius[1],center[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];
                    }));
                }
                for(let row=0;row<rings;row++) for(let i=0;i<sides;i++) {
                    const next=(i+1)%sides;
                    const polygon=row===0?[points[row][i],points[row+1][i],points[row+1][next]]:
                        row===rings-1?[points[row][i],points[row+1][i],points[row][next]]:
                        [points[row][i],points[row+1][i],points[row+1][next],points[row][next]];
                    face(polygon,color,part);
                }
            }
            function limb(a,b,radius,color,part) {
                const along=unit(sub(b,a)), right=unit(cross(along,Math.abs(along[1])>.9?[1,0,0]:[0,1,0])), up=cross(along,right);
                const points=[a,b].map(center=>Array.from({length:6},(_,i)=>center.map((v,j)=>v+radius*(right[j]*Math.cos(i*Math.PI/3)+up[j]*Math.sin(i*Math.PI/3)))));
                for(let i=0;i<6;i++){const next=(i+1)%6;face([points[0][i],points[0][next],points[1][next],points[1][i]],color,part);}
                face([...points[0]].reverse(),color,part); face(points[1],color,part);
            }
            // Seated proportions, with feet below knees and hands resting on the lap.
            ellipsoid([sway,1.13+breath,-.015],[.265,.41,.165],shirt,'torso');
            ellipsoid([sway*.65,1.72+breath,.015+nod],[.175,.215,.18],skin,'head',turn);
            ellipsoid([sway*.65,1.825+breath,-.025+nod],[.177,.125,.17],hair[(key>>>7)%hair.length],'hair',turn);
            if (low) continue;
            limb([sway*.8,1.43+breath,0],[sway*.7,1.55+breath,.01],.075,skin,'neck');
            // A small nose makes the direction of the seated head readable when looking sideways.
            ellipsoid([sway*.65+Math.sin(turn)*.17,1.71+breath,.177+nod],[.038,.045,.045],skin,'face');
            for(const side of [-1,1]) {
                const x=side*.14, knee=[x,.61,scene.depth*.55];
                limb([x,.78,.025],knee,.105,pants,'thigh');
                limb(knee,[x,.15,scene.depth*.57],.075,pants,'shin');
                ellipsoid([x,.095,scene.depth*.66],[.095,.075,.17],[48,51,54],'shoe');
                const shoulder=[side*.225+sway,1.32+breath,-.005], elbow=[side*.29+sway*.4,.99,.08];
                limb(shoulder,elbow,.075,shirt,'sleeve');
                limb(elbow,[side*.18,.86+breath,scene.depth*.31],.055,skin,'forearm');
                ellipsoid([side*.18,.855+breath,scene.depth*.34],[.065,.045,.09],skin,'hand');
            }
        }
        return faces;
    }
    return { seatIndices, buildFaces };
});
