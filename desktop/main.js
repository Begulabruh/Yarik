const {app,BrowserWindow,shell}=require('electron');const cfg=require('./config.json');
app.whenReady().then(()=>{
 const w=new BrowserWindow({width:1100,height:740,minWidth:380,title:'Yarik',autoHideMenuBar:true,backgroundColor:'#0f1020'});
 w.loadURL(cfg.server);
 w.webContents.on('did-fail-load',(e,c,d,u,main)=>{if(main&&u===cfg.server+'/'||u===cfg.server)w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Нет связи с сервером Yarik</h2><p>'+cfg.server+'</p><p>Проверьте интернет и перезапустите приложение.</p>'))});
 w.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:'deny'}})});
app.on('window-all-closed',()=>app.quit());
