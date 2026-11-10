/* Test harness only. It operates the unchanged released desktop artifact. */
const { _electron, chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { unzipSync, zlibSync } = require('fflate');

const root = path.resolve(process.env.SMOKE_OUTPUT || 'work/windows-smoke-results');
const runtime = path.join(root, 'runtime 中文');
const downloads = path.join(root, 'downloads 中文');
for (const dir of [root, runtime, downloads]) fs.mkdirSync(dir, { recursive: true });
const report = { artifactCommit: '75f1127ed4a2874d612503c72b08b678cb9d5e30', platform: process.platform,
  os: require('node:os').release(), flavor: process.env.SMOKE_FLAVOR || 'browser-dry-run',
  startedAt: new Date().toISOString(), cases: [], pageErrors: [], httpErrors: [], conversionResponses: [], dialogs: [] };
let app, browser, page, context, lastArtifact;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const writeReport = () => fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout; let value;
  do { value = await fn(); if (value) return value; await pause(250); } while (Date.now() < end);
  throw new Error('Timed out waiting for condition');
}
async function check(name, fn) {
  const started = Date.now(); console.log('START', name);
  try { const evidence = await fn(); report.cases.push({ name, status: 'passed', ms: Date.now()-started, evidence }); }
  catch (error) {
    report.cases.push({ name, status: 'failed', ms: Date.now()-started, error: error.stack });
    try { fs.writeFileSync(path.join(root, name+'.txt'), await page.locator('body').innerText()); } catch {}
    console.error('FAIL', name, error.message);
  }
  if(process.env.SMOKE_EVIDENCE==='1')try { await page.screenshot({ path: path.join(root, name+'.png'), timeout: 10000 }); } catch {}
  writeReport(); console.log('END', name, report.cases.at(-1).status);
}
function pngFixture(filename) {
  const width=64, height=48, rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const p=y*(width*4+1)+1+x*4;
    const color=y<24 ? (x<32?[0,255,255]:[255,255,0]) : (x<32?[255,0,255]:[255,255,255]);
    color.forEach((v,i)=>rows[p+i]=v);rows[p+3]=255;
  }
  function crc(data) {let c=0xffffffff; for(const v of data) {c^=v;for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
  function chunk(type,bytes) {const d=Buffer.concat([Buffer.from(type),Buffer.from(bytes)]),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(bytes.length);sum.writeUInt32BE(crc(d));return Buffer.concat([len,d,sum]);}
  const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
  fs.writeFileSync(filename,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlibSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
const png=path.join(root,'原图 空格.png'); pngFixture(png);
const svg=path.join(root,'矢量 空格.svg');
fs.writeFileSync(svg,'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="32" height="48" fill="#00ffff"/><path d="M32 0H64V48H32Z" fill="#ff00ff"/></svg>');

async function boot() {
  const env={...process.env, LUMINA_MAX_WORKERS:'2', LUMINA_FEEDBACK_SERVER_URL:'off',
    LUMINA_SETTINGS_PATH:path.join(runtime,'settings.json'), LUMINA_OUTPUT_DIR:path.join(runtime,'output'),
    LUMINA_MATERIALS_DIR:path.join(runtime,'materials'), LUMINA_RUNTIME_CACHE_DIR:path.join(runtime,'cache'),
    LUMINA_LOG_DIR:path.join(runtime,'logs'), LUMINA_FEEDBACK_DUMP_DIR:path.join(runtime,'feedback'),
    LUMINA_WORKSHOP_DATA_DIR:path.join(runtime,'workshop'), LUMINA_CUSTOM_LUT_DIR:path.join(runtime,'lut','Custom'),
    LUMINA_CLOUD_LUT_DIR:path.join(runtime,'lut','Cloud'), NUMBA_CACHE_DIR:path.join(runtime,'numba'),
    ELECTRON_ENABLE_LOGGING:'1', ELECTRON_LOG_FILE:path.join(root,'electron-chromium.log')};
  delete env.LUMINA_SMOKE_TEST; delete env.LUMINA_SMOKE_TEST_RESULT;
  if(process.env.SMOKE_URL) {
    browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
    context=await browser.newContext({viewport:{width:1536,height:960},acceptDownloads:true});
  } else {
    app=await _electron.launch({executablePath:process.env.SMOKE_EXE,env,timeout:240000});
    app.process().stdout?.on('data',d=>fs.appendFileSync(path.join(root,'electron-stdout.log'),d));
    app.process().stderr?.on('data',d=>fs.appendFileSync(path.join(root,'electron-stderr.log'),d));
    context=app.context();
    // Native pickers are supplied paths by the harness; real IPC and disk writes run unchanged.
    await app.evaluate(({dialog},dir)=>{
      global.__smokeSaves=[];global.__smokeOpen=null;
      const pick=options=>{const base=String(options.defaultPath||'export.bin').split(/[\\/]/).pop();const file=dir+'/'+base;global.__smokeSaves.push(file);return file;};
      dialog.showSaveDialog=async(...args)=>({canceled:false,filePath:pick(args.at(-1))});
      dialog.showSaveDialogSync=(...args)=>pick(args.at(-1));
      dialog.showOpenDialog=async()=>global.__smokeOpen?{canceled:false,filePaths:[global.__smokeOpen]}:{canceled:true,filePaths:[]};
      dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});
    },downloads);
  }
  context.on('page',p=>p.on('pageerror',e=>report.pageErrors.push({url:p.url(),error:e.stack||String(e)})));
  context.on('response',async r=>{
    const u=r.url();if(r.status()>=400&&u.includes('/api/')) report.httpErrors.push({url:u,status:r.status()});
    if(/\/api\/convert\/(preview|generate|puzzle-layout-preview)$/.test(u)) {
      let body;try{body=await r.json();}catch{}
      report.conversionResponses.push({url:u,status:r.status(),body});
    }
  });
  if(process.env.SMOKE_EVIDENCE==='1')await context.tracing.start({screenshots:true,snapshots:true});
  if(browser){page=await context.newPage();await page.goto(process.env.SMOKE_URL,{waitUntil:'domcontentloaded'});}
  else {page=await until(async()=>{for(const p of app.windows()) if(/^http:\/\/127\.0\.0\.1/.test(p.url())) return p;return null;},240000);}
  page.setDefaultTimeout(20000);
  await page.getByTestId('studio-shell').waitFor({timeout:120000});
  const announcement=page.getByRole('button',{name:'知道了',exact:true});
  if(await announcement.isVisible())await announcement.click();
  else {await pause(750);if(await announcement.isVisible())await announcement.click();}
  await page.getByTestId('studio-nav-converter').click();
  await page.getByTestId('studio-workbench').waitFor();
}
async function size(w,h) {
  await page.getByRole('textbox',{name:'宽度 value',exact:true}).fill(String(w));
  await page.getByRole('textbox',{name:'宽度 value',exact:true}).press('Enter');
  if(h!==undefined){await page.getByRole('textbox',{name:'高度 value',exact:true}).fill(String(h));await page.getByRole('textbox',{name:'高度 value',exact:true}).press('Enter');}
}
async function dimensions(){return {width:Number(await page.getByRole('textbox',{name:'宽度 value',exact:true}).inputValue()),height:Number(await page.getByRole('textbox',{name:'高度 value',exact:true}).inputValue())};}
async function setSwitch(name,on){const input=page.getByRole('switch',{name,exact:true});if(await input.isChecked()!==on)await input.locator('..').click();}
async function chooseLut() {
  const radio=page.locator('input[type=radio][value=legacy]');if(!await radio.isChecked())await radio.locator('..').click();
  await page.getByTestId('lut-picker-trigger').click();
  const dialog=page.getByTestId('lut-picker-dialog');await dialog.waitFor();
  await dialog.getByTestId('lut-picker-brand-option-Aliz').click();
  await dialog.getByTestId('lut-picker-search-input').fill('Aliz&4色PLA&CMYW');
  const choices=dialog.getByTestId('lut-picker-option');await choices.first().waitFor();
  if(await choices.first().getAttribute('aria-checked')!=='true')await choices.first().click();
  await dialog.getByRole('button',{name:'确认',exact:true}).click();
}
async function importImage(file){await page.locator('input[type=file][accept*="image/jpeg"]').first().setInputFiles(file);await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-tutorial="image-upload"] img')).some(e=>e.complete&&e.naturalWidth>0));}
async function preview(){
  const response=page.waitForResponse(r=>/\/api\/convert\/preview$/.test(r.url())&&r.request().method()==='POST',{timeout:180000});
  await page.locator('[data-tutorial="preview-button"] button').click();
  const r=await response; const body=await r.json();assert.equal(r.status(),200,JSON.stringify(body));
  await until(async()=>await page.locator('[data-studio-action="generate-export"]').isEnabled(),180000);
  return body;
}
function inspectZip(file){const entries=unzipSync(fs.readFileSync(file));const names=Object.keys(entries);assert(names.length>0);if(file.endsWith('.3mf')){assert(names.some(n=>n.endsWith('.model')));assert(names.some(n=>n.endsWith('.model')&&Buffer.from(entries[n]).toString().includes('<triangle')));}return {file,bytes:fs.statSync(file).size,entries:names};}
async function savedFiles(){return app?await app.evaluate(()=>global.__smokeSaves||[]):[];}
async function generate() {
  const start=report.conversionResponses.length;
  if(browser){const dl=page.waitForEvent('download',{timeout:180000});await page.locator('[data-studio-action="generate-export"]').click();const d=await dl;const f=path.join(downloads,d.suggestedFilename());await d.saveAs(f);return inspectZip(f);}
  const before=(await savedFiles()).length;
  await page.locator('[data-studio-action="generate-export"]').click();
  const file=await until(async()=>{const list=await savedFiles();return list.length>before?list.at(-1):null;},180000);
  await until(()=>fs.existsSync(file)&&fs.statSync(file).size>0,60000);
  await pause(300);
  lastArtifact=report.conversionResponses.slice(start).find(x=>x.url.endsWith('/generate')&&x.status===200)?.body;
  return inspectZip(file);
}
async function newProject(){
  await page.getByTestId('project-bar').getByRole('button',{name:'更多工程操作',exact:true}).click();
  await page.getByRole('menuitem',{name:'新建工程',exact:true}).click();
  await page.getByRole('dialog',{name:'新建工程',exact:true}).getByRole('button',{name:'创建',exact:true}).click();
  const discard=page.getByRole('button',{name:'放弃修改',exact:true});
  if(await discard.isVisible())await discard.click();
  await until(async()=>!await page.getByRole('dialog',{name:'新建工程',exact:true}).isVisible());
  await page.getByTestId('studio-nav-converter').click();
}
async function clearModal(){await page.keyboard.press('Escape');const close=page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true});if(await close.count()===1&&await close.isVisible())await close.click();}

(async()=>{
 try{
  await boot();
  await check('01-owned-backend-and-shell',async()=>{const r=await page.request.get(new URL('/api/health',page.url()).href);const body=await r.json();assert.equal(r.status(),200);assert.equal(body.status,'ok');assert.equal(body.worker_pool.healthy,true);return {url:page.url(),...body};});
  await check('02-page-navigation-and-command-palette',async()=>{
    for(const id of ['vectorizer','workshop','material-library','gradient-card-generate','material-recipe','lut-library','calibration','lut-details','five-color','lut-manager','settings']){await page.getByTestId('studio-nav-'+id).click();assert((await page.locator('main').innerText()).trim().length>0);}
    await page.getByTestId('studio-palette-button').click();await page.getByTestId('studio-command-palette').waitFor();await page.keyboard.press('Escape');
    await page.getByTestId('studio-nav-converter').click();return {pages:11};
  });
  await check('03-raster-import-preview-and-3mf',async()=>{
    await setSwitch('上传后裁剪',false);await chooseLut();await importImage(png);await size(40);
    const p=await preview();const output=await generate();return {dimensions:await dimensions(),session:p.session_id,output};
  });
  if(process.env.SMOKE_DRY_LIMIT)return;
  await check('04-project-save-and-reopen',async()=>{
    if(!app)return {skipped:'local browser harness verification only'};
    const before=(await savedFiles()).length;await page.getByTestId('project-bar').getByRole('button',{name:'保存',exact:true}).click();
    const file=await until(async()=>{const list=await savedFiles();return list.length>before?list.at(-1):null;});
    await until(()=>fs.existsSync(file)&&fs.statSync(file).size>0);const info=inspectZip(file);assert(file.endsWith('.lum'));
    await newProject();await app.evaluate((_e,p)=>{global.__smokeOpen=p;},file);
    await page.getByTestId('project-bar').getByRole('button',{name:'打开',exact:true}).click();
    const discard=page.getByRole('button',{name:'放弃修改',exact:true});if(await discard.isVisible())await discard.click();
    await until(async()=>Math.abs((await dimensions()).width-40)<0.1,60000);await preview();return info;
  });
  await check('05-download-survives-source-session-close',async()=>{
    const body=lastArtifact;const url=body?.download_url;assert(url,'No successful generation response download_url');
    const before=await page.request.get(new URL(url,page.url()).href);assert.equal(before.status(),200);
    await newProject();const after=await page.request.get(new URL(url,page.url()).href);assert.equal(after.status(),200);return {url,before:before.status(),after:after.status()};
  });
  await check('06-native-svg-preview-and-3mf',async()=>{await newProject();await setSwitch('上传后裁剪',false);await chooseLut();await importImage(svg);await size(40);const p=await preview();return {session:p.session_id,output:await generate()};});
  await check('07-magnet-preview-and-3mf',async()=>{
    await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-fridge-magnet').click();await size(40);
    const p=await preview();return {session:p.session_id,output:await generate()};
  });
  await check('08-large-format-assembly-png',async()=>{
    await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-large-format').click();await size(80);
    await page.getByRole('textbox',{name:'切片宽度 value',exact:true}).fill('50');await page.getByRole('textbox',{name:'切片宽度 value',exact:true}).press('Enter');
    await page.getByRole('textbox',{name:'切片高度 value',exact:true}).fill('50');await page.getByRole('textbox',{name:'切片高度 value',exact:true}).press('Enter');
    await preview();const before=(await savedFiles()).length;await page.getByTestId('studio-assembly').getByRole('button').click();
    if(!app)return {skipped:'native save checked on Windows'};
    const file=await until(async()=>{const list=await savedFiles();return list.length>before?list.at(-1):null;});await until(()=>fs.existsSync(file));assert.equal(fs.readFileSync(file).subarray(1,4).toString(),'PNG');return {file,bytes:fs.statSync(file).size};
  });
  await check('08b-puzzle-assembly-png',async()=>{
    await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-puzzle').click();await size(80);
    const fields=page.getByTestId('studio-product-puzzle').locator('input[type=number]');for(const i of [0,1]){await fields.nth(i).fill('2');await fields.nth(i).press('Tab');}
    await preview();const button=page.getByTestId('studio-assembly').getByRole('button');await until(()=>button.isEnabled(),60000);
    const before=(await savedFiles()).length;const started=Date.now();await button.click();if(!app)return {skipped:'native save checked on Windows'};
    const file=await until(async()=>{const list=await savedFiles();return list.length>before?list.at(-1):null;});
    await until(()=>fs.existsSync(file)&&fs.statSync(file).mtimeMs>=started-100);assert.equal(fs.readFileSync(file).subarray(1,4).toString(),'PNG');return {file,bytes:fs.statSync(file).size};
  });
  await check('09-home-empty-slicer-detection-bounded',async()=>{
    let requests=0;const count=r=>{if(new URL(r.url()).pathname==='/api/slicer/detect')requests++;};page.on('request',count);
    await page.getByTestId('studio-nav-home').click();await pause(3000);page.off('request',count);assert(requests<=5,`${requests} slicer detection requests in 3 seconds`);return {requests,observationMs:3000};
  });
  await check('10-template-large-format-keeps-400mm',async()=>{
    await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-large-format').click();const d=await dimensions();assert.equal(Math.max(d.width,d.height),400);return d;
  });
  await check('11-template-resets-outline',async()=>{
    await page.getByTestId('studio-product-outline').getByRole('button').first().click();await setSwitch('启用外轮廓',true);
    await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-framed').click();
    const card=page.getByTestId('studio-product-outline');const text=await card.innerText();assert(!text.includes('已开启'),text);return {outlineCard:text};
  });
  await check('12-puzzle-template-persists-through-image-import',async()=>{
    await newProject();await setSwitch('上传后裁剪',false);await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-puzzle').click();
    await importImage(png);const on=await page.getByRole('switch',{name:'启用拼图模式',exact:true}).isChecked();assert.equal(on,true,'Import switched puzzleEnabled off');return {enabled:on};
  });
  await check('13-keychain-template-size-before-image-import',async()=>{
    await newProject();await setSwitch('上传后裁剪',false);await size(150,150);await page.getByTestId('studio-nav-home').click();await page.getByTestId('studio-template-keychain').click();await importImage(png);await pause(300);const d=await dimensions();assert.equal(Math.max(d.width,d.height),50);return d;
  });
  await check('14-selective-cleanup-keeps-unexpired-download',async()=>{
    if(!app)return {skipped:'requires packaged runtime fixture paths'};
    await newProject();await setSwitch('上传后裁剪',false);await chooseLut();await importImage(png);await size(40);await preview();await generate();
    const url=lastArtifact?.download_url;assert(url,'Missing download URL');const before=await page.request.get(new URL(url,page.url()).href);assert.equal(before.status(),200);
    const files=[];const walk=dir=>{if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.3mf$/i.test(e.name))files.push(f);}};walk(path.join(runtime,'output'));
    assert(files.length>0,'No generated runtime 3MF to age');const old=(Date.now()-11*60000)/1000;for(const f of files)fs.utimesSync(f,old,old);
    await page.getByTestId('studio-nav-settings').click();const storage=page.getByTestId('studio-storage');
    await storage.getByRole('button',{name:'重新统计',exact:true}).click();const temp=storage.locator('li').filter({hasText:'临时文件'}).getByRole('checkbox');await temp.check();
    await storage.getByRole('button',{name:'清理所选',exact:true}).click();await storage.getByRole('status').waitFor();
    const after=await page.request.get(new URL(url,page.url()).href);assert.equal(after.status(),200,'Selective cleanup invalidated a live 1-hour download');return {url,before:before.status(),after:after.status(),agedFiles:files.length};
  });
 }catch(error){report.fatal=error.stack;console.error(error);}
 finally{
  if(process.env.SMOKE_EVIDENCE==='1')try{await context?.tracing.stop({path:path.join(root,'trace.zip')});}catch{}
  try{if(page&&app)await page.evaluate(()=>window.electronAPI.projects.setDirty(false));}catch{}
  if(app){const timer=setTimeout(()=>app.process()?.kill(),15000);timer.unref();try{await app.close();}catch{app.process()?.kill();}finally{clearTimeout(timer);}}else{try{await browser?.close();}catch{}}
  report.finishedAt=new Date().toISOString();report.summary={passed:report.cases.filter(x=>x.status==='passed').length,failed:report.cases.filter(x=>x.status==='failed').length};writeReport();console.log(JSON.stringify(report.summary));
  process.exitCode=report.fatal||report.summary.failed?1:0;
 }
})();
