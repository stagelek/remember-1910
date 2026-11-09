const start=document.getElementById('start'),status=document.getElementById('status');let busy=false,app;
start.addEventListener('click',async()=>{
  if(busy)return;busy=true;start.disabled=true;status.textContent='AR 화면을 준비하고 있습니다…';
  try{
    if(!window.isSecureContext)throw new Error('HTTPS 주소에서 열어 주세요.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('이 브라우저는 카메라에 접근할 수 없습니다. Chrome 또는 Safari에서 열어 주세요.');
    // Fullscreen is requested directly in the tap handler; unsupported browsers keep their normal bars.
    if(document.documentElement.requestFullscreen&&!document.fullscreenElement)try{await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{}
    app=await import('./engine.js?v=20261109-web2');
    await app.start(message=>{status.textContent=message;});
  }catch(error){
    status.textContent=error?.message||'카메라를 열지 못했습니다. 카메라 사용을 허용한 뒤 다시 눌러 주세요.';
    await app?.stop({exitFullscreen:true});
    if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}
  }finally{busy=false;start.disabled=false;}
});
