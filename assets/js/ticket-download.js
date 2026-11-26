// Portrait PNG for phone screens. All rendering stays local; QR data is unchanged.
window.tsTicketDownload = {
    canvas(details) {
        if(typeof details?.payload!=='string'||!details.payload||details.payload.length>512||typeof qrcode!=='function')throw Error('Ticket entry data is unavailable.');
        const qr=qrcode(0,'M');qr.addData(details.payload,'Byte');qr.make();
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
        if(!ctx)throw Error('Ticket image generation is unavailable in this browser.');
        const width=900,pad=60,content=width-pad*2;
        const lines=(text,size,maxWidth)=>{
            ctx.font=`${size===46?'700 ':''}${size}px system-ui, sans-serif`;
            const result=[];let line='';
            for(const char of String(text||'Not available').replace(/[\r\n\t]+/g,' ').slice(0,600)){
                if(line&&ctx.measureText(line+char).width>maxWidth){
                    const space=line.lastIndexOf(' ');
                    if(space>line.length/2){result.push(line.slice(0,space).trim());line=line.slice(space+1);}
                    else {result.push(line.trim());line='';}
                }
                line+=char;
            }
            if(line)result.push(line.trim());return result;
        };
        const title=lines(details.eventName||'Event ticket',46,content);
        const fields=[['DATE & TIME (MALAYSIA, UTC+8)',details.date],['VENUE',details.venue],['CATEGORY',details.category],['SEAT',details.seat]];
        const prepared=fields.map(([label,value])=>({label,lines:lines(value,30,content)}));
        const qrCount=qr.getModuleCount(),moduleSize=Math.floor(600/(qrCount+8)),qrSize=(qrCount+8)*moduleSize;
        const qrTop=230+title.length*56+prepared.reduce((sum,f)=>sum+52+f.lines.length*40,0);
        canvas.width=width;canvas.height=qrTop+qrSize+250;
        ctx.fillStyle='#f3f4f8';ctx.fillRect(0,0,width,canvas.height);
        ctx.fillStyle='#ffffff';ctx.fillRect(24,24,width-48,canvas.height-48);
        ctx.fillStyle='#111827';ctx.fillRect(24,24,width-48,105);
        ctx.fillStyle='#ffffff';ctx.font='700 40px system-ui, sans-serif';ctx.fillText('ticksecure',pad,92);
        ctx.fillStyle='#6d28d9';ctx.font='600 21px system-ui, sans-serif';ctx.fillText('YOUR DIGITAL EVENT TICKET',pad,176);
        let y=235;ctx.fillStyle='#111827';ctx.font='700 46px system-ui, sans-serif';
        for(const line of title){ctx.fillText(line,pad,y);y+=56;}
        y+=24;
        for(const field of prepared){
            ctx.fillStyle='#64748b';ctx.font='600 19px system-ui, sans-serif';ctx.fillText(field.label,pad,y);y+=36;
            ctx.fillStyle='#111827';ctx.font='30px system-ui, sans-serif';
            for(const line of field.lines){ctx.fillText(line,pad,y);y+=40;}
            y+=16;
        }
        const x=Math.floor((width-qrSize)/2);
        ctx.fillStyle='#ffffff';ctx.fillRect(x,qrTop,qrSize,qrSize);
        ctx.fillStyle='#000000';
        for(let row=0;row<qrCount;row++)for(let col=0;col<qrCount;col++)if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*moduleSize,qrTop+(row+4)*moduleSize,moduleSize,moduleSize);
        y=qrTop+qrSize+48;ctx.textAlign='center';ctx.fillStyle='#111827';ctx.font='600 25px system-ui, sans-serif';ctx.fillText('Scan at entry · Face verification required',width/2,y);
        ctx.font='20px system-ui, sans-serif';ctx.fillStyle='#64748b';ctx.fillText('One entry only. Keep this ticket and QR code private.',width/2,y+40);
        ctx.fillText('Entry depends on the current ticket and event status.',width/2,y+72);
        ctx.font='19px ui-monospace, monospace';ctx.fillText(`Ticket ID: ${String(details.ticketId||'').slice(0,160)}`,width/2,y+120,content);
        return {canvas,qr:{x,y:qrTop,moduleSize,count:qrCount,size:qrSize}};
    },
    async png(details) {
        const {canvas}=this.canvas(details);
        return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not create the ticket image. Please try again.')),'image/png'));
    }
};
