import { generateText, preferBoundary, seedToUint32 } from './generator-utils.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const uid = () => crypto.randomUUID();
const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const state = {
  blocks: [], tests: [], outputs: [], currentTest: 0,
  seed: '2026', fileCount: 5, multi: false, caseMin: 2, caseMax: 5
};

const blockNames = { variables:'Biến trên một dòng', array:'Mảng 1D', matrix:'Ma trận', graph:'Đồ thị', tree:'Cây', literal:'Văn bản' };
const blockTags = { variables:'123', array:'[ ]', matrix:'▦', graph:'⌘', tree:'⑂', literal:'“”' };
const defaults = {
  variables: () => ({ id:uid(), type:'variables', section:'global', vars:[{name:'n',kind:'int',min:'1',max:'100',mode:'random'}] }),
  array: () => ({ id:uid(), type:'array', section:'global', length:'n', kind:'int', min:'-100', max:'100', valueMode:'random', distinct:false, sortAsc:false, sortDesc:false, permutation:false, binary:false, allEqual:false, boundary:false }),
  matrix: () => ({ id:uid(), type:'matrix', section:'global', rows:'n', cols:'m', kind:'int', min:'0', max:'100', mode:'random', valueMode:'random' }),
  graph: () => ({ id:uid(), type:'graph', section:'global', nodes:'n', edges:'m', weighted:false, min:'1', max:'100', directed:false, connected:true, selfLoops:false, multiEdges:false, printHeader:false, dag:false, bipartite:false, zeroIndexed:false }),
  tree: () => ({ id:uid(), type:'tree', section:'global', nodes:'n', weighted:false, min:'1', max:'100', printHeader:false, shape:'random', zeroIndexed:false }),
  literal: () => ({ id:uid(), type:'literal', section:'global', mode:'fixed', text:'# text', length:'10', chars:'abcdefghijklmnopqrstuvwxyz' })
};

const presets = {
  array() { return [
    { ...defaults.variables(), vars:[{name:'n',kind:'int',min:'1',max:'100'}] },
    { ...defaults.array(), length:'n', min:'-1000', max:'1000' }
  ]},
  multiArray() { return [
    { ...defaults.variables(), section:'case', vars:[{name:'n',kind:'int',min:'1',max:'100'}] },
    { ...defaults.array(), section:'case', length:'n', min:'-1000', max:'1000' }
  ]},
  matrix() { return [
    { ...defaults.variables(), vars:[{name:'n',kind:'int',min:'1',max:'20'},{name:'m',kind:'int',min:'1',max:'20'}] },
    { ...defaults.matrix(), rows:'n', cols:'m' }
  ]},
  graph() { return [
    { ...defaults.variables(), vars:[{name:'n',kind:'int',min:'2',max:'50'},{name:'m',kind:'int',min:'1',max:'100'}] },
    { ...defaults.graph(), nodes:'n', edges:'m' }
  ]},
  tree() { return [
    { ...defaults.variables(), vars:[{name:'n',kind:'int',min:'2',max:'100'}] },
    { ...defaults.tree(), nodes:'n' }
  ]}
};

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function save() {
  localStorage.setItem('cp-test-forge', JSON.stringify({ blocks:state.blocks, seed:state.seed, fileCount:state.fileCount, multi:state.multi, caseMin:state.caseMin, caseMax:state.caseMax }));
}

function load() {
  try { Object.assign(state, JSON.parse(localStorage.getItem('cp-test-forge') || '{}')); } catch {}
  if (!state.blocks?.length) { state.blocks = presets.multiArray().map(x => ({...x, section:'case'})); state.multi = true; }
  state.blocks.forEach(block => {
    if(block.type==='array'&&block.sorted){block.sortAsc=true;delete block.sorted;}
    if(block.type==='array')block.valueMode??='random';
    if(block.type==='matrix')block.valueMode??='random';
    if(block.type==='literal'){block.mode??='fixed';block.length??='10';block.chars??='abcdefghijklmnopqrstuvwxyz';}
    if(block.type==='variables')block.vars.forEach(variable=>{
      if(variable.mode==='min'||variable.mode==='max')variable.mode='boundary';
      variable.mode??='random';
    });
  });
  $('#seed').value = state.seed; $('#fileCount').value = state.fileCount; $('#multiCase').checked = state.multi;
  $('#caseMin').value = state.caseMin; $('#caseMax').value = state.caseMax;
  toggleMulti(false); renderBlocks();
}

function field(label, name, value, options = null, span = '') {
  const content = options
    ? `<select data-field="${name}">${options.map(([v,t]) => `<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select>`
    : `<input data-field="${name}" value="${escapeHtml(value)}" />`;
  return `<label class="field ${span}">${label}${content}</label>`;
}

function variableRows(block) {
  return `<div class="variable-rows"><div class="variable-labels"><span>Tên</span><span>Kiểu</span><span>Min / độ dài</span><span>Max / ký tự</span><span>Cách sinh</span><span></span></div>${block.vars.map((v,i) => `<div class="variable-row" data-var="${i}">
    <input data-vfield="name" value="${escapeHtml(v.name)}" placeholder="tên: n" />
    <select data-vfield="kind"><option value="int" ${v.kind==='int'?'selected':''}>Số nguyên</option><option value="float" ${v.kind==='float'?'selected':''}>Số thực</option><option value="word" ${v.kind==='word'?'selected':''}>Chuỗi</option><option value="char" ${v.kind==='char'?'selected':''}>Ký tự</option></select>
    <input data-vfield="min" value="${escapeHtml(v.min)}" placeholder="min / độ dài" />
    <input data-vfield="max" value="${escapeHtml(v.max)}" placeholder="max / tập ký tự" />
    <select data-vfield="mode"><option value="random" ${(v.mode||'random')==='random'?'selected':''}>Ngẫu nhiên trong khoảng</option><option value="boundary" ${v.mode==='boundary'?'selected':''}>Ưu tiên cận biên</option></select>
    <button data-remove-var="${i}" title="Xóa">×</button></div>`).join('')}<button class="add-var" data-add-var>+ Thêm biến cùng dòng</button></div>`;
}

function option(label, name, checked) {
  return `<label class="option-pill"><input data-field="${name}" type="checkbox" ${checked?'checked':''}><span>${label}</span></label>`;
}

function blockBody(block) {
  const kinds = [['int','Số nguyên'],['float','Số thực'],['word','Chuỗi'],['char','Ký tự']];
  if (block.type === 'variables') return variableRows(block);
  if (block.type === 'array') return field('Độ dài (số hoặc biến)','length',block.length)+field('Kiểu phần tử','kind',block.kind,kinds)+field(block.kind==='word'?'Độ dài':'Giá trị min','min',block.min)+field(block.kind==='word'||block.kind==='char'?'Tập ký tự':'Giá trị max','max',block.max)+field('Cách sinh phần tử','valueMode',block.valueMode||'random',[['random','Ngẫu nhiên trong khoảng'],['boundary','Ưu tiên cận biên']])+`<div class="option-grid span-4">${option('Không trùng','distinct',block.distinct)}${option('Sắp xếp tăng','sortAsc',block.sortAsc||block.sorted)}${option('Sắp xếp giảm','sortDesc',block.sortDesc)}${option('Hoán vị 1…n','permutation',block.permutation)}${option('Nhị phân 0/1','binary',block.binary)}${option('Tất cả bằng nhau','allEqual',block.allEqual)}${['int','float'].includes(block.kind)?option('Chỉ lấy min/max','boundary',block.boundary):''}</div>`;
  if (block.type === 'matrix') return field('Số hàng','rows',block.rows)+field('Số cột','cols',block.cols)+field('Kiểu phần tử','kind',block.kind,kinds.slice(0,2))+field('Dạng ma trận','mode',block.mode||'random',[['random','Ngẫu nhiên'],['binary','Nhị phân 0/1'],['identity','Đơn vị'],['symmetric','Đối xứng']])+field('Min','min',block.min)+field('Max','max',block.max)+field('Cách sinh phần tử','valueMode',block.valueMode||'random',[['random','Ngẫu nhiên trong khoảng'],['boundary','Ưu tiên cận biên']]);
  if (block.type === 'graph') return field('Số đỉnh','nodes',block.nodes)+field('Số cạnh','edges',block.edges)+field('Trọng số min','min',block.min)+field('Trọng số max','max',block.max)+`<div class="option-grid span-4">${option('Liên thông','connected',block.connected)}${option('Có hướng','directed',block.directed)}${option('DAG','dag',block.dag)}${option('Hai phía','bipartite',block.bipartite)}${option('Có trọng số','weighted',block.weighted)}${option('Self-loop','selfLoops',block.selfLoops)}${option('Đa cạnh','multiEdges',block.multiEdges)}${option('Đỉnh từ 0','zeroIndexed',block.zeroIndexed)}${option('In n m trước cạnh','printHeader',block.printHeader)}</div>`;
  if (block.type === 'tree') return field('Số đỉnh','nodes',block.nodes)+field('Hình dạng','shape',block.shape||'random',[['random','Ngẫu nhiên'],['path','Đường thẳng'],['star','Hình sao'],['binary','Cây nhị phân']])+field('Trọng số min','min',block.min)+field('Trọng số max','max',block.max)+`<div class="option-grid span-4">${option('Có trọng số','weighted',block.weighted)}${option('Đỉnh từ 0','zeroIndexed',block.zeroIndexed)}${option('In n trước cạnh','printHeader',block.printHeader)}</div>`;
  const textMode=field('Cách sinh','mode',block.mode||'fixed',[['fixed','Cố định'],['random','Ngẫu nhiên'],['boundary','Ưu tiên ký tự biên']]);
  if((block.mode||'fixed')==='fixed')return textMode+`<label class="field span-4">Nội dung<textarea data-field="text" rows="3">${escapeHtml(block.text)}</textarea></label>`;
  return textMode+field('Độ dài (số hoặc biến)','length',block.length)+field('Tập ký tự','chars',block.chars,null,'span-2');
}

function renderBlocks() {
  for (const section of ['global','case']) {
    const zone = $(`.dropzone[data-section="${section}"]`);
    zone.innerHTML = state.blocks.filter(b => b.section === section).map(block => `<article class="format-block" data-id="${block.id}">
      <div class="block-head"><span class="drag">⠿</span><span class="tag">${blockTags[block.type]}</span><span class="block-title">${blockNames[block.type]}</span><span class="block-actions"><button data-move="up" title="Lên">↑</button><button data-move="down" title="Xuống">↓</button><button data-remove title="Xóa">×</button></span></div>
      <div class="block-body">${blockBody(block)}</div></article>`).join('');
  }
  $('#formatSummary').textContent = `${state.blocks.length} khối`;
  bindBlocks(); save();
}

function bindBlocks() {
  $$('.format-block').forEach(el => {
    const block = state.blocks.find(b => b.id === el.dataset.id);
    el.querySelectorAll('[data-field]').forEach(input => input.addEventListener('change', () => {
      const name = input.dataset.field;
      block[name] = input.type === 'checkbox' ? input.checked : input.value;
      if (block.type === 'array' && input.checked) {
        if (name === 'sortAsc') { block.sortDesc = false; block.sorted = false; }
        if (name === 'sortDesc') { block.sortAsc = false; block.sorted = false; }
        if (name === 'permutation') Object.assign(block,{binary:false,allEqual:false,boundary:false,distinct:true,kind:'int'});
        if (name === 'binary') Object.assign(block,{permutation:false,allEqual:false,boundary:false,kind:'int'});
        if (name === 'allEqual') Object.assign(block,{permutation:false,binary:false,boundary:false,distinct:false});
        if (name === 'boundary') Object.assign(block,{permutation:false,binary:false,allEqual:false});
      }
      if(block.type==='array'&&name==='kind'&&!['int','float'].includes(input.value))block.boundary=false;
      if (block.type === 'graph' && name === 'dag' && input.checked) Object.assign(block,{directed:true,selfLoops:false});
      if (block.type === 'graph' && name === 'bipartite' && input.checked) block.selfLoops=false;
      if (block.type === 'matrix' && name === 'mode' && input.value !== 'random') block.kind='int';
      renderBlocks();
    }));
    el.querySelectorAll('[data-vfield]').forEach(input => input.addEventListener('change', () => {
      block.vars[Number(input.closest('[data-var]').dataset.var)][input.dataset.vfield] = input.value; save();
    }));
    el.querySelector('[data-remove]')?.addEventListener('click', () => { state.blocks = state.blocks.filter(b => b.id !== block.id); renderBlocks(); });
    el.querySelector('[data-add-var]')?.addEventListener('click', () => { block.vars.push({name:'m',kind:'int',min:'1',max:'100',mode:'random'}); renderBlocks(); });
    el.querySelectorAll('[data-remove-var]').forEach(btn => btn.addEventListener('click', () => { if(block.vars.length>1) block.vars.splice(Number(btn.dataset.removeVar),1); renderBlocks(); }));
    el.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => moveBlock(block, btn.dataset.move)));
  });
}

function moveBlock(block, direction) {
  const peers = state.blocks.filter(b => b.section === block.section);
  const pos = peers.indexOf(block), target = peers[pos + (direction === 'up' ? -1 : 1)];
  if (!target) return;
  const a = state.blocks.indexOf(block), b = state.blocks.indexOf(target);
  [state.blocks[a], state.blocks[b]] = [state.blocks[b], state.blocks[a]]; renderBlocks();
}

function toggleMulti(move = true) {
  state.multi = $('#multiCase').checked;
  $('#caseCountWrap').classList.toggle('hidden', !state.multi); $('#caseArea').classList.toggle('hidden', !state.multi);
  if (!state.multi && move) state.blocks.forEach(b => { if (b.section === 'case') b.section = 'global'; });
  if (state.multi && move && state.blocks.length && !state.blocks.some(b => b.section === 'case')) state.blocks.forEach(b => b.section = 'case');
  renderBlocks();
}

function mulberry32(seed) { return function() { let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296; }; }
function int(rng,min,max) { min=Math.ceil(Number(min));max=Math.floor(Number(max));if(!Number.isFinite(min)||!Number.isFinite(max)||min>max) throw new Error(`Khoảng [${min}, ${max}] không hợp lệ`);return Math.floor(rng()*(max-min+1))+min; }
function number(rng,min,max) { const n=Number(min)+(Number(max)-Number(min))*rng(); return Number(n.toFixed(4)); }
function expr(raw, ctx) {
  let value=String(raw).replace(/[A-Za-z_]\w*/g,name => { if(!(name in ctx)) throw new Error(`Chưa định nghĩa biến “${name}”`); return Number(ctx[name]); });
  if (!/^[\d+\-*/%().\s]+$/.test(value)) throw new Error(`Biểu thức không hợp lệ: ${raw}`);
  const result=Function(`"use strict";return (${value})`)();
  if(!Number.isFinite(result)) throw new Error(`Không tính được biểu thức: ${raw}`); return Math.floor(result);
}
function randomWord(rng,length,chars='abcdefghijklmnopqrstuvwxyz') { return generateText(rng,length,chars); }
function valueFor(rng,kind,min,max) {
  if(kind==='int') return int(rng,expr(min,{}),expr(max,{}));
  if(kind==='float') return number(rng,min,max);
  if(kind==='char') return randomWord(rng,1,String(max||min||'abc'));
  return randomWord(rng,int(rng,Number(min)||1,Math.max(Number(min)||1,Number(min)||1)),String(max||'abcdefghijklmnopqrstuvwxyz'));
}
function shuffle(values,rng){for(let i=values.length-1;i>0;i--){const j=int(rng,0,i);[values[i],values[j]]=[values[j],values[i]];}return values;}
function normalizeTestCase(value){
  return String(value??'').replace(/\r\n?/g,'\n').split('\n').map(line=>line.trim()).join('\n').trim();
}

function generateBlock(block, ctx, rng) {
  if(block.type==='variables') {
    const vals=block.vars.map(v => {
      let value; const boundary=v.mode==='boundary';
      if(v.kind==='int') {const lo=expr(v.min,ctx),hi=expr(v.max,ctx);value=boundary?preferBoundary(rng,lo,hi,()=>int(rng,lo,hi)):int(rng,lo,hi);}
      else if(v.kind==='float') {const lo=Number(v.min),hi=Number(v.max);value=boundary?preferBoundary(rng,lo,hi,()=>number(rng,lo,hi)):number(rng,lo,hi);}
      else if(v.kind==='char') {const chars=String(v.max||'abcdefghijklmnopqrstuvwxyz');value=boundary?preferBoundary(rng,chars[0],chars.at(-1),()=>randomWord(rng,1,chars)):randomWord(rng,1,chars);}
      else {const length=Number(v.min)||1,chars=String(v.max||'abcdefghijklmnopqrstuvwxyz');value=boundary?preferBoundary(rng,chars[0].repeat(length),chars.at(-1).repeat(length),()=>randomWord(rng,length,chars)):randomWord(rng,length,chars);}
      if(v.name) ctx[v.name]=value; return value;
    }); return vals.join(' ');
  }
  if(block.type==='array') {
    const len=expr(block.length,ctx); if(len<0||len>100000) throw new Error('Độ dài mảng phải từ 0 đến 100000');
    const preferEdges=block.valueMode==='boundary';
    const makeValue=()=>{
      if(block.kind==='int'){const lo=expr(block.min,ctx),hi=expr(block.max,ctx);if(block.boundary)return rng()<.5?lo:hi;return preferEdges?preferBoundary(rng,lo,hi,()=>int(rng,lo,hi)):int(rng,lo,hi);}
      if(block.kind==='float'){const lo=expr(block.min,ctx),hi=expr(block.max,ctx);if(block.boundary)return rng()<.5?lo:hi;return preferEdges?preferBoundary(rng,lo,hi,()=>number(rng,lo,hi)):number(rng,lo,hi);}
      const chars=String(block.max||'abc'),length=block.kind==='char'?1:expr(block.min,ctx);
      return generateText(rng,length,chars,preferEdges);
    };
    let values=[];
    if(block.permutation) values=shuffle(Array.from({length:len},(_,i)=>i+1),rng);
    else if(block.binary) {
      if(block.distinct&&len>2) throw new Error('Mảng nhị phân không trùng chỉ có thể dài tối đa 2');
      values=block.distinct?shuffle([0,1],rng).slice(0,len):Array.from({length:len},()=>int(rng,0,1));
    }
    else if(block.allEqual) {
      if(block.distinct&&len>1) throw new Error('“Tất cả bằng nhau” không thể kết hợp “Không trùng” khi độ dài lớn hơn 1');
      const value=makeValue();
      values=Array(len).fill(value);
    } else if(block.kind==='int' && block.distinct) {
      const lo=expr(block.min,ctx),hi=expr(block.max,ctx);
      if(block.boundary){const candidates=[...new Set([lo,hi])];if(len>candidates.length)throw new Error('Chỉ có min/max nên không đủ giá trị để tạo mảng không trùng');values=shuffle(candidates,rng).slice(0,len);}
      else {if(hi-lo+1<len) throw new Error('Khoảng giá trị không đủ để tạo mảng không trùng');const used=new Set();while(values.length<len){const v=makeValue();if(!used.has(v)){used.add(v);values.push(v);}}}
    } else for(let i=0;i<len;i++) {
      values.push(makeValue());
    }
    if(block.distinct&&block.kind!=='int'&&!block.permutation&&!block.binary&&!block.allEqual){
      const unique=[...new Map(values.map(value=>[String(value),value])).values()];let attempts=0;
      while(unique.length<len&&attempts++<len*100+1000){const candidate=makeValue();if(!unique.some(value=>String(value)===String(candidate)))unique.push(candidate);}
      if(unique.length<len)throw new Error('Không đủ giá trị khác nhau với kiểu và tập ký tự đã chọn');values=unique;
    }
    const compare=(a,b)=>typeof a==='number'?a-b:String(a).localeCompare(String(b));
    if(block.sortAsc||block.sorted) values.sort(compare);
    if(block.sortDesc) values.sort(compare).reverse();
    return values.join(' ');
  }
  if(block.type==='matrix') {
    const rows=expr(block.rows,ctx),cols=expr(block.cols,ctx); if(rows*cols>200000||rows<0||cols<0) throw new Error('Ma trận quá lớn');
    const mode=block.mode||'random';
    if((mode==='identity'||mode==='symmetric')&&rows!==cols) throw new Error('Ma trận đơn vị/đối xứng phải có số hàng bằng số cột');
    const randomValue=()=>{if(mode==='binary')return int(rng,0,1);const lo=expr(block.min,ctx),hi=expr(block.max,ctx),fallback=()=>block.kind==='float'?number(rng,lo,hi):int(rng,lo,hi);return block.valueMode==='boundary'?preferBoundary(rng,lo,hi,fallback):fallback();};
    const matrix=Array.from({length:rows},()=>Array(cols).fill(0));
    if(mode==='identity') for(let i=0;i<rows;i++) matrix[i][i]=1;
    else if(mode==='symmetric') for(let i=0;i<rows;i++)for(let j=i;j<cols;j++)matrix[i][j]=matrix[j][i]=randomValue();
    else for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)matrix[i][j]=randomValue();
    return matrix.map(row=>row.join(' ')).join('\n');
  }
  if(block.type==='tree') {
    const n=expr(block.nodes,ctx); if(n<1||n>100000) throw new Error('Số đỉnh cây phải từ 1 đến 100000');
    const lines=[]; if(block.printHeader) lines.push(String(n));
    for(let v=2;v<=n;v++){
      const parent=block.shape==='path'?v-1:block.shape==='star'?1:block.shape==='binary'?Math.floor(v/2):int(rng,1,v-1);
      const edge=[block.zeroIndexed?v-1:v,block.zeroIndexed?parent-1:parent];if(block.weighted)edge.push(int(rng,expr(block.min,ctx),expr(block.max,ctx)));lines.push(edge.join(' '));
    } return lines.join('\n');
  }
  if(block.type==='graph') {
    const n=expr(block.nodes,ctx),m=expr(block.edges,ctx); if(n<1||n>100000||m<0||m>200000) throw new Error('Kích thước đồ thị không hợp lệ');
    const directed=block.directed||block.dag, allowLoops=block.selfLoops&&!block.dag&&!block.bipartite;
    const max=block.multiEdges?Infinity:block.bipartite?Math.floor(n/2)*Math.ceil(n/2)*(directed?2:1):block.dag?n*(n-1)/2:(directed?n*n:n*(n+1)/2)-(allowLoops?0:n);
    if(m>max||(block.connected&&m<n-1)) throw new Error('Số cạnh không phù hợp với các ràng buộc đồ thị');
    const edges=[],seen=new Set(); const add=(rawU,rawV)=>{let u=rawU,v=rawV;if(block.dag&&u>v)[u,v]=[v,u];if(!allowLoops&&u===v)return false;if(block.bipartite&&u%2===v%2)return false;const key=directed?`${u},${v}`:`${Math.min(u,v)},${Math.max(u,v)}`;if(!block.multiEdges&&seen.has(key))return false;seen.add(key);const e=[block.zeroIndexed?u-1:u,block.zeroIndexed?v-1:v];if(block.weighted)e.push(int(rng,expr(block.min,ctx),expr(block.max,ctx)));edges.push(e.join(' '));return true;};
    if(block.connected) for(let v=2;v<=n;v++){
      let parent;
      if(block.bipartite){const candidates=[];for(let u=1;u<v;u++)if(u%2!==v%2)candidates.push(u);parent=candidates[int(rng,0,candidates.length-1)];}
      else parent=int(rng,1,v-1);
      add(parent,v);
    }
    let attempts=0; while(edges.length<m&&attempts++<m*60+1000){const u=int(rng,1,n),v=int(rng,1,n);add(u,v);} if(edges.length<m)throw new Error('Không thể sinh đủ cạnh với các tùy chọn đã chọn');
    const lines=[];if(block.printHeader)lines.push(`${n} ${m}`);return lines.concat(edges).join('\n');
  }
  if(block.type==='literal')return (block.mode||'fixed')==='fixed'?block.text:generateText(rng,expr(block.length,ctx),block.chars||'abcdefghijklmnopqrstuvwxyz',block.mode==='boundary');
  return '';
}

function buildTests() {
  syncSettings(); if(!state.blocks.length) throw new Error('Hãy thêm ít nhất một khối');
  const rng=mulberry32(seedToUint32(state.seed)), files=[];
  for(let f=0;f<state.fileCount;f++) {
    const ctx={}, lines=[];
    for(const block of state.blocks.filter(b=>b.section==='global')) lines.push(generateBlock(block,ctx,rng));
    if(state.multi) {
      const t=int(rng,state.caseMin,state.caseMax); lines.push(String(t));
      for(let c=0;c<t;c++){const caseCtx={...ctx,t};for(const block of state.blocks.filter(b=>b.section==='case'))lines.push(generateBlock(block,caseCtx,rng));}
    }
    files.push(normalizeTestCase(lines.filter(x=>x!==''&&x!=null).join('\n')));
  }
  state.tests=files;state.outputs=[];state.currentTest=0;renderTests();save();
}

function syncSettings(){state.seed=$('#seed').value||'0';state.fileCount=Math.min(100,Math.max(1,Number($('#fileCount').value)||1));state.caseMin=Math.max(1,Number($('#caseMin').value)||1);state.caseMax=Math.max(state.caseMin,Number($('#caseMax').value)||state.caseMin);}
function renderTests(){
  $('#testTabs').innerHTML=state.tests.map((_,i)=>`<button class="${i===state.currentTest?'active':''}" data-test="${i}">${String(i+1).padStart(3,'0')}.in</button>`).join('');
  $('#currentFile').textContent=`${String(state.currentTest+1).padStart(3,'0')}.in`;$('#inputPreview').value=state.tests[state.currentTest]||'';
  $$('[data-test]').forEach(b=>b.onclick=()=>{state.tests[state.currentTest]=normalizeTestCase($('#inputPreview').value);state.currentTest=Number(b.dataset.test);renderTests();});
}
function go(step){if(step===3&&!state.tests.length){toast('Hãy sinh test trước');return;}if(step===4&&state.outputs.length!==state.tests.length){toast('Hãy chạy solution thành công trước');return;}$$('.workspace').forEach(x=>x.classList.toggle('active',x.dataset.panel==step));$$('.step').forEach(x=>{x.classList.toggle('active',x.dataset.step==step);x.classList.toggle('done',Number(x.dataset.step)<step)});window.scrollTo({top:0,behavior:'smooth'});}

async function runAll(){
  if(!state.tests.length)return toast('Chưa có input'); const sourceCode=$('#sourceCode').value;if(!sourceCode.trim())return toast('Hãy nhập source code');
  state.tests[state.currentTest]=normalizeTestCase($('#inputPreview').value);state.tests=state.tests.map(normalizeTestCase);renderTests();const btn=$('#runBtn');btn.disabled=true;btn.textContent='Đang chạy…';$('#runResults').innerHTML='<div class="empty-state"><b>⋯</b><span>Compiler đang biên dịch và chạy</span></div>';
  try {const response=await fetch('/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceCode,language:$('#language').value,inputs:state.tests})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Không thể chạy code');
    state.outputs=data.results.map(r=>r.stdout||'');renderResults(data.results);const ok=data.results.filter(r=>r.statusId===3).length;$('#runSummary').textContent=`${ok}/${data.results.length} thành công`;if(ok===data.results.length){$('#exportSummary').textContent=`${ok} cặp input / output`;toast('Đã tạo đủ output');}else toast('Một số test chạy không thành công');
  }catch(error){$('#runResults').innerHTML=`<div class="empty-state"><b>!</b><span>${escapeHtml(error.message)}</span></div>`;toast(error.message);}finally{btn.disabled=false;btn.textContent='▶ Chạy tất cả';}
}
function renderResults(results){$('#runResults').innerHTML=results.map((r,i)=>{const ok=r.statusId===3;const detail=r.stdout||(r.compileOutput||r.stderr||r.message||'(không có output)');return `<div class="result-item"><div class="result-line"><span>${String(i+1).padStart(3,'0')}.in → ${String(i+1).padStart(3,'0')}.out</span><span class="${ok?'accepted':'failed'}">${escapeHtml(r.status)} · ${r.time??'—'}s</span></div><pre class="result-output">${escapeHtml(detail)}</pre></div>`}).join('');}

async function exportZip(){if(state.outputs.length!==state.tests.length)return toast('Output chưa đầy đủ');state.tests=state.tests.map(normalizeTestCase);const response=await fetch('/api/export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inputs:state.tests,outputs:state.outputs,archiveName:$('#archiveName').value})});if(!response.ok)return toast('Không thể tạo ZIP');const blob=await response.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${$('#archiveName').value||'testcases'}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

function codeTemplate(lang){return ({cpp17:'#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n',c:'#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n',java:'import java.io.*;\nimport java.util.*;\n\nclass Main {\n    public static void main(String[] args) throws Exception {\n    }\n}\n',python3:'import sys\n\ndef solve():\n    pass\n\nif __name__ == "__main__":\n    solve()\n',javascript:'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim();\n'})[lang];}

$$('[data-add]').forEach(btn=>btn.onclick=()=>{const block=defaults[btn.dataset.add]();block.section=state.multi?'case':'global';state.blocks.push(block);renderBlocks();});
$('#multiCase').onchange=()=>toggleMulti(true);$('#clearBtn').onclick=()=>{state.blocks=[];renderBlocks();};
$('#presetSelect').onchange=e=>{if(!e.target.value)return;state.blocks=presets[e.target.value]();state.multi=e.target.value==='multiArray';$('#multiCase').checked=state.multi;if(state.multi)state.blocks.forEach(b=>b.section='case');toggleMulti(false);renderBlocks();};
$('#generateBtn').onclick=()=>{try{buildTests();go(2);}catch(e){toast(e.message);}};$('#regenerateBtn').onclick=()=>{try{buildTests();toast('Đã sinh lại với seed hiện tại');}catch(e){toast(e.message);}};
$$('[data-go]').forEach(btn=>btn.onclick=()=>go(Number(btn.dataset.go)));$$('.step').forEach(btn=>btn.onclick=()=>go(Number(btn.dataset.step)));
$('#inputPreview').onchange=()=>{state.tests[state.currentTest]=$('#inputPreview').value;};$('#copyInput').onclick=async()=>{await navigator.clipboard.writeText($('#inputPreview').value);toast('Đã sao chép');};
$('#runBtn').onclick=runAll;$('#exportBtn').onclick=exportZip;
$('#language').onchange=e=>{const ext={cpp17:'main.cpp',c:'main.c',java:'Main.java',python3:'main.py',javascript:'main.js'};$('#codeHint').textContent=ext[e.target.value];if(confirm('Thay code hiện tại bằng mẫu của ngôn ngữ này?'))$('#sourceCode').value=codeTemplate(e.target.value);};
$('#themeBtn').onclick=()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('theme',document.documentElement.classList.contains('dark')?'dark':'light');};
if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');
$('#sourceCode').value=codeTemplate('cpp17');
fetch('/api/health').then(r=>{if(!r.ok)throw 0;return r.json()}).then(x=>{ $('#judgeStatus').classList.add(x.compiler==='ok'?'ok':'bad'); $('#judgeStatus').lastChild.textContent=` ${x.engine==='piston'?'Piston':'Judge0'}`; }).catch(()=>$('#judgeStatus').classList.add('bad'));
load();
