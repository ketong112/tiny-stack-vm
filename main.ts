// Tiny stack VM (ISA v1): runs /input/<id>/, writes /output/<id>/. Node 22.
// 32-bit wrapping ints, 256-value stack, 64-deep call stack, 256 words of
// memory, 1,000,000 steps and 65,536 output bytes at most, ten traps.
import{mkdirSync as m,readdirSync as r,readFileSync as f,writeFileSync as w}from 'node:fs';
import{join as j}from 'node:path';
const e=new TextEncoder();
function run(p,q){
const S=new Int32Array(256);let sp=0;
const K=new Int32Array(64);let cp=0;
const M=new Int32Array(256);
const O=new Uint8Array(65536);
let ol=0,ip=0,pc=0,st=0;const N=p.length;
const d=c=>({out:O.slice(0,ol),code:c});
for(;;){
if(st===1e6)return d(10);
if(pc<0||pc>=N)return d(9);
const o=p[pc];let a=0,b=0,c=0;
switch(o){
case 0:break;
case 1:a=1;c=1;break;
case 2:a=4;c=1;break;
case 3:b=1;break;
case 4:b=1;c=2;break;
case 5:b=2;c=2;break;
case 6:b=2;c=3;break;
case 7:b=3;c=3;break;
case 23:case 27:b=1;c=1;break;
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:b=2;c=1;break;
case 48:a=2;break;
case 49:case 50:a=2;b=1;break;
case 51:a=2;break;
case 52:break;
case 64:b=1;c=1;break;
case 65:b=2;break;
case 80:case 81:case 83:b=1;break;
case 82:c=1;break;
default:return d(5);
}
if(pc+a>=N)return d(9);
st++;
const x=pc+1+a;
if(sp<b)return d(2);
if(sp-b+c>256)return d(3);
pc=x;
switch(o){
case 0:return d(0);
case 1:S[sp++]=(p[x-1]<<24)>>24;break;
case 2:S[sp++]=p[x-4]|p[x-3]<<8|p[x-2]<<16|p[x-1]<<24;break;
case 3:sp--;break;
case 4:S[sp]=S[sp-1];sp++;break;
case 5:{const t=S[sp-1];S[sp-1]=S[sp-2];S[sp-2]=t;break;}
case 6:S[sp]=S[sp-2];sp++;break;
case 7:{const t=S[sp-3];S[sp-3]=S[sp-2];S[sp-2]=S[sp-1];S[sp-1]=t;break;}
case 23:S[sp-1]=-S[sp-1]|0;break;
case 27:S[sp-1]=~S[sp-1];break;
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{
const y=S[sp-1],z=S[sp-2];let v;
if(o===16)v=(z+y)|0;
else if(o===17)v=(z-y)|0;
else if(o===18)v=Math.imul(z,y);
else if(o===19){if(!y)return d(4);v=z===-2147483648&&y===-1?z:(z/y)|0;}
else if(o===20){if(!y)return d(4);v=y===-1?0:(z%y)|0;}
else if(o===21){if(!y)return d(4);v=Math.floor((z>>>0)/(y>>>0))|0;}
else if(o===22){if(!y)return d(4);v=(z>>>0)%(y>>>0)|0;}
else if(o===24)v=z&y;
else if(o===25)v=z|y;
else if(o===26)v=z^y;
else if(o===28)v=z<<(y&31);
else if(o===29)v=z>>(y&31);
else if(o===30)v=(z>>>(y&31))|0;
else if(o===32)v=z===y?1:0;
else if(o===33)v=z<y?1:0;
else v=(z>>>0)<(y>>>0)?1:0;
sp-=2;S[sp++]=v;break;}
case 48:case 49:case 50:{
const t=((p[x-2]|p[x-1]<<8)<<16)>>16;let k=true;
if(o!==48){const v=S[--sp];k=o===49?v===0:v!==0;}
if(k)pc=x+t;break;}
case 51:
if(cp===64)return d(7);
K[cp++]=x;pc=p[x-2]|p[x-1]<<8;break;
case 52:
if(cp===0)return d(8);
pc=K[--cp];break;
case 64:{
const v=S[sp-1];
if(v<0||v>=256)return d(6);
S[sp-1]=M[v];break;}
case 65:{
const v=S[sp-1],u=S[sp-2];
if(v<0||v>=256)return d(6);
sp-=2;M[v]=u;break;}
case 80:{
const g=e.encode(String(S[sp-1]));
if(ol+g.length>65536)return d(11);
sp--;O.set(g,ol);ol+=g.length;break;}
case 81:
if(ol+1>65536)return d(11);
O[ol++]=S[--sp]&255;break;
case 82:S[sp++]=ip<q.length?q[ip++]:-1;break;
case 83:return d(S[--sp]&255);
}
}
}
const I=process.env.MAKEFUN_INPUT_DIR??'/input';
const P=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of r(I).sort()){
const v=run(new Uint8Array(f(j(I,id,'program.bin'))),new Uint8Array(f(j(I,id,'input.bin'))));
m(j(P,id),{recursive:true});
w(j(P,id,'stdout.bin'),v.out);
w(j(P,id,'exit.txt'),v.code+'\n');
}
