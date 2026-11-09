export function createImmersiveMenu({surface, menu, guide, hint, schedule=setTimeout, cancel=clearTimeout, delay=3200}) {
  let active=false, seen=false, down=null, menuTimer=null, hintTimer=null;
  const clearMenu=()=>{if(menuTimer!==null)cancel(menuTimer);menuTimer=null;};
  function hide(){clearMenu();menu.hidden=true;}
  function show(){if(!active)return;clearMenu();menu.hidden=false;menuTimer=schedule(hide,delay);}
  function toggle(){if(menu.hidden)show();else hide();}
  function downHandler(event){if(active)down={x:event.clientX,y:event.clientY,id:event.pointerId};}
  function upHandler(event){if(!active||!down||down.id!==event.pointerId)return;const start=down;down=null;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>12)return;if(event.target?.closest?.('button,a,input,select,textarea,summary'))return;toggle();}
  const cancelHandler=()=>{down=null;};surface.addEventListener('pointerdown',downHandler);surface.addEventListener('pointerup',upHandler);surface.addEventListener('pointercancel',cancelHandler);
  return {
    activate(){active=true;seen=false;hide();guide.hidden=false;hint.hidden=false;if(hintTimer!==null)cancel(hintTimer);hintTimer=schedule(()=>{guide.hidden=true;hint.hidden=true;hintTimer=null;},2600);},
    found(){guide.hidden=true;hint.hidden=true;if(!seen){seen=true;hide();}},
    show,hide,toggle,
    refresh(){if(!menu.hidden)show();},
    deactivate(){active=false;down=null;hide();guide.hidden=true;hint.hidden=true;if(hintTimer!==null)cancel(hintTimer);hintTimer=null;},
    destroy(){this.deactivate();surface.removeEventListener('pointerdown',downHandler);surface.removeEventListener('pointerup',upHandler);surface.removeEventListener('pointercancel',cancelHandler);}
  };
}
