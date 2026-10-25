(() => {
  "use strict";

  const SUPPORTED = new Set(["M_Toadragon", "M_YoungDevour", "M_PuppetKing", "M_DevilSmeltedFears", "M_Eggknight", "M_Knighteater", "M_PalebloodWorms", "M_KingLaidLow", "M_KnightFen"]);

  function render({ cells, board, options = {}, seed = 17, helpers: h }) {
    const id = options.monsterInk;
    if (!SUPPORTED.has(id) || !cells?.length || !h) return null;
    cells = [...new Set(cells.map(Number).filter(cell => cell > 0 && cell <= board.cols * board.rows))].sort((a,b) => a-b);
    if (!cells.length) return null;
    const col = cell => (cell - 1) % board.cols;
    const row = cell => Math.floor((cell - 1) / board.cols);
    const origin = cell => [col(cell) * 100, row(cell) * 100];
    const rand = (offset, local = seed) => h.random(local, offset);
    const polygon = (points, opacity = 1) => `<path d="${h.polygon(points)}" opacity="${opacity}"/>`;
    const ribbon = (points, local, weight = .95, opacity = 1) => `<path d="${h.ribbon(points, local, weight)}" opacity="${opacity}"/>`;
    const contour = (points, local, width = 0, opacity = 1) => `<path d="${h.brush(points, local, width)}" fill-rule="evenodd" opacity="${opacity}"/>`;
    const curve = (anchors, local, weight = .95, opacity = 1) => {
      const points = [];
      anchors.forEach((point, i) => {
        if (!i) { points.push(point); return; }
        const a = anchors[i-1], b = point, before = anchors[Math.max(0,i-2)], after = anchors[Math.min(anchors.length-1,i+1)];
        h.bezier(points,a,[a[0]+(b[0]-before[0])*.16,a[1]+(b[1]-before[1])*.16],
          [b[0]-(after[0]-a[0])*.16,b[1]-(after[1]-a[1])*.16],b,10);
      });
      return ribbon(points,local,weight,opacity);
    };
    const ovalPoints = (cx,cy,rx,ry,local,angle=0) => Array.from({length:48},(_,i) => {
      const t=i/48*Math.PI*2, wobble=1+(rand(i+11,local)-.5)*.035;
      const u=Math.cos(t)*rx*wobble,v=Math.sin(t)*ry*wobble;
      return [cx+u*Math.cos(angle)-v*Math.sin(angle),cy+u*Math.sin(angle)+v*Math.cos(angle)];
    });
    const oval = (cx,cy,rx,ry,local,angle=0,opacity=1) => contour(ovalPoints(cx,cy,rx,ry,local,angle),local,0,opacity);
    const glyph = (character,box,local,weight=1.35,angle=0) => h.glyph(character==="！"?"!":character,box,local,weight,angle,Math.floor(rand(31,local)*3));
    const escaped = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
    const brushPaths = window.KF_HANDWRITTEN_BRUSH_PATHS || Object.freeze({});
    const brushGlyph = (value,x,y,size,angle=0,opacity=1) => {
      const path = brushPaths[value==="！"?"!":value];
      if(!path) return `<text data-brush-text="${escaped(value)}" x="0" y="0" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="currentColor" opacity="${opacity}" transform="translate(${x} ${y}) rotate(${Number((angle*180/Math.PI).toFixed(2))}) skewX(-4)" style="font-family:STXingKa,'KaiTi','STKaiti',serif">${escaped(value)}</text>`;
      return `<path data-brush-glyph="${escaped(value)}" d="${path}" fill="currentColor" opacity="${opacity}" transform="translate(${x} ${y}) rotate(${Number((angle*180/Math.PI).toFixed(2))}) skewX(-4) scale(${Number((size/100).toFixed(4))}) translate(-50 -50)"/>`;
    };
    const brushWordMark = (word,startX,y,size,angle=0,opacity=1) => word.map((char,index) =>
      brushGlyph(char,startX+index*size*.91+size*.455,y+size*.5,size,angle,opacity)).join("");

    function runs(vertical) {
      const selected = new Set(cells), result=[];
      for(const cell of cells) {
        const step=vertical?board.cols:1;
        if(selected.has(cell-step)&&(vertical||col(cell)>0))continue;
        const run=[cell];
        while((vertical||col(run.at(-1))<board.cols-1)&&selected.has(run.at(-1)+step))run.push(run.at(-1)+step);
        result.push({cells:run,vertical});
      }
      return result.sort((a,b)=>b.cells.length-a.cells.length||a.cells[0]-b.cells[0]);
    }
    function runWord(text,run,local,maxSize=84) {
      const chars=[...text], [x,y]=origin(run.cells[0]);
      const length=run.cells.length*100, size=Math.min(maxSize,(length-20)/chars.length-5);
      const pitch=Math.min(size+7,(length-20)/chars.length), start=(length-pitch*chars.length)/2;
      return `<g data-special-text="${text}" data-special-text-axis="${run.vertical?"vertical":"horizontal"}" data-special-text-cells="${run.cells.join(",")}">${chars.map((char,i)=>{
        const along=start+pitch*(i+.5),cx=x+(run.vertical?50:along),cy=y+(run.vertical?along:50);
        return glyph(char,[cx-size/2,cy-size/2,size,size],local+i*31,1.5,(rand(37,local)-.5)*.08);
      }).join("")}</g>`;
    }
    function ordered() {
      const selected=new Set(cells), original=(options.attackOrder||[]).map(Number).filter(cell=>selected.has(cell));
      return [...new Set([...original,...cells])];
    }
    function cellPhrase(text,local) {
      const spaces=ordered();
      while([...text].length>spaces.length&&text.startsWith("!"))text=text.slice(1);
      while([...text].length>spaces.length&&text.endsWith("!"))text=text.slice(0,-1);
      const chars=[...text],buckets=spaces.map(()=>[]);
      chars.forEach((char,i)=>buckets[Math.min(spaces.length-1,Math.floor(i*spaces.length/chars.length))].push(char));
      return `<g data-special-text="${text}">${spaces.map((cell,index)=>{
        const [x,y]=origin(cell), group=buckets[index];
        if(!group.length)return "";
        const size=Math.min(76,80/group.length),total=size*group.length;
        return `<g data-special-cell="${cell}">${group.map((char,i)=>glyph(char,[x+50-total/2+i*size,y+50-size/2,size,size],local+index*41+i*19,char==="!"?1.65:1.5,(rand(7,local+index)-.5)*.11)).join("")}</g>`;
      }).join("")}</g>`;
    }
    function eye(cx,cy,size,local,angle=0) {
      const pupil=ovalPoints(cx,cy,size*.12,size*.31,local+17,angle+Math.PI/2);
      const outline=ovalPoints(cx,cy,size*.49,size*.38,local,angle);
      return `<g data-toad-eye="true">${polygon(outline,.08)}${ribbon([...outline,outline[0]],local,.44,.98)}${polygon(pupil,.95)}</g>`;
    }
    function toad() {
      const vertical=(Number(options.attackFacing)||0)%180!==0;
      const minX=Math.min(...cells.map(col))*100,maxX=(Math.max(...cells.map(col))+1)*100;
      const minY=Math.min(...cells.map(row))*100,maxY=(Math.max(...cells.map(row))+1)*100;
      const targetX=(minX+maxX)/2,targetY=(minY+maxY)/2;
      const bands=runs(vertical),readable=bands.filter(run=>run.cells.length>=2);
      const candidates=readable.length?readable:bands;
      const distance=run=>{
        const [x,y]=origin(run.cells[0]),cx=x+(vertical?50:run.cells.length*50),cy=y+(vertical?run.cells.length*50:50);
        return (cx-targetX)**2+(cy-targetY)**2;
      };
      candidates.sort((a,b)=>distance(a)-distance(b)||b.cells.length-a.cells.length||a.cells[0]-b.cells[0]);
      const strip=candidates[0],text=rand(191)<.5?"咕咕嘎嘎":"蹦蹦跳跳";
      const [sx,sy]=origin(strip.cells[0]),length=strip.cells.length*100;
      let size=Math.min(84,(length-20)/4-4),centerX=sx+(vertical?50:length/2),centerY=sy+(vertical?length/2:50);
      const selected=new Set(cells),inside=box=>{
        for(let r=Math.floor(box[1]/100);r<=Math.floor((box[1]+box[3]-.01)/100);r++)
          for(let c=Math.floor(box[0]/100);c<=Math.floor((box[0]+box[2]-.01)/100);c++)
            if(c<0||c>=board.cols||r<0||r>=board.rows||!selected.has(r*board.cols+c+1))return false;
        return true;
      };
      // Center across cell seams when the complete lettering rectangle fits the attack.
      for(let candidate=84;candidate>=20;candidate-=2){
        const span=candidate*4+15,box=vertical?[targetX-candidate/2,targetY-span/2,candidate,span]
          :[targetX-span/2,targetY-candidate/2,span,candidate];
        if(inside(box)){size=candidate;centerX=targetX;centerY=targetY;break;}
      }
      const pitch=size+5,textWidth=size+pitch*3;
      const captionBox=vertical?[centerX-size/2,centerY-textWidth/2,size,textWidth]
        :[centerX-textWidth/2,centerY-size/2,textWidth,size];
      const caption=`<g data-special-text="${text}" data-special-text-axis="${vertical?"vertical":"horizontal"}" data-special-text-cells="${strip.cells.join(",")}" data-special-text-box="${captionBox.join(",")}">${[...text].map((char,i)=>{
        const along=pitch*(i-1.5),cx=centerX+(vertical?0:along),cy=centerY+(vertical?along:0);
        const weight=char==="蹦"?1.1:char==="跳"?1.4:1.6;
        return glyph(char,[cx-size/2,cy-size/2,size,size],seed+71+i*31,weight,(rand(37,seed)-.5)*.06);
      }).join("")}</g>`;
      const eyes=cells.map(cell=>{
        const [x,y]=origin(cell),s=seed+cell*43,count=14+Math.floor(rand(5,s)*5),centers=[];
        for(let attempt=0;attempt<300&&centers.length<count;attempt++) {
          const px=12+rand(attempt*3+11,s)*76,py=12+rand(attempt*3+13,s)*76;
          if(centers.some(([cx,cy])=>Math.hypot(cx-px,cy-py)<13))continue;
          centers.push([px,py]);
        }
        return `<g data-toad-eye-cell="${cell}">${centers.map(([px,py],i)=>eye(x+px,y+py,13+rand(i+131,s)*7,s+i*37,(rand(i+157,s)-.5)*.7)).join("")}</g>`;
      }).join("");
      return `<g data-monster-motif="toad-eyes"><g data-toad-background="true">${eyes}</g>${caption}</g>`;
    }
    function teeth() {
      const angle=(Number(options.attackFacing)||0)*Math.PI/180;
      return `<g data-monster-motif="two-rows-of-teeth">${cells.map(cell=>{
        const [x,y]=origin(cell),localSeed=seed+cell*43;
        const physical=point=>{const u=point[0]-50,v=point[1]-50;return [x+50+u*Math.cos(angle)-v*Math.sin(angle),y+50+u*Math.sin(angle)+v*Math.cos(angle)];};
        const rows=[0,1].map(side=>{
          const count=rand(side+11,localSeed)>.45?3:2,pitch=84/count,sign=side?-1:1,base=side?87:13;
          return `<g data-tooth-row="${side?"lower":"upper"}">${Array.from({length:count},(_,j)=>{
            const s=localSeed+side*43+j*17,toothX=8+pitch*(j+.5),half=pitch*.44,depth=26+rand(11,s)*11;
            const local=[[toothX-half,base],[toothX-half*.66,base+sign*12],[toothX+(rand(7,s)-.5)*7,base+sign*depth],[toothX+half*.65,base+sign*13],[toothX+half,base-1]];
            const points=[];
            local.forEach((p,i)=>{
              if(!i){points.push(p);return;}
              const before=local[i-1],dx=p[0]-before[0],dy=p[1]-before[1];
              h.bezier(points,before,[before[0]+dx*.35-1,before[1]+dy*.2],[before[0]+dx*.7+1,before[1]+dy*.8],p,10);
            });
            const shape=points.map(physical);
            return polygon(shape,.08)+contour(shape,s,.2,.95);
          }).join("")}</g>`;
        }).join("");
        return `<g data-tooth-cell="${cell}">${rows}</g>`;
      }).join("")}</g>`;
    }
    function spear() {
      const facing=((Number(options.attackFacing)||0)+90)%360,vertical=facing%180===0;
      const run=runs(vertical)[0]||runs(!vertical)[0], [x,y]=origin(run.cells[0]);
      const length=run.cells.length*100,negative=[0,270].includes(facing);
      const position=(u,v)=>[x+(vertical?v:(negative?length-u:u)),y+(vertical?(negative?length-u:u):v)];
      const shaft=curve([position(12,52),position(length*.48,49),position(length-54,50)],seed+11,1.9,.9);
      const head=[position(length-75,50),position(length-44,33),position(length-10,50),position(length-44,67)];
      const flames=[];
      for(let i=0;i<Math.max(3,run.cells.length*2);i++) {
        const u=30+i*(length-60)/Math.max(3,run.cells.length*2),s=seed+i*37;
        const up=i%2?-1:1;
        flames.push(curve([position(u,50),position(u+9,50+up*16),position(u+3,50+up*(30+rand(11,s)*10)),position(u+25,50+up*21),position(u+37,50)],s,1.1,.7));
      }
      const remaining=cells.filter(cell=>!run.cells.includes(cell)).map(cell=>{
        const [px,py]=origin(cell),s=seed+cell*31;
        return curve([[px+17,py+72],[px+36,py+51],[px+31,py+19],[px+64,py+47],[px+83,py+28]],s,1.2,.63);
      });
      return `<g data-monster-motif="flaming-spear">${shaft}${polygon(head,.08)}${contour(head,seed+29,.3,.95)}${flames.join("")}${remaining.join("")}</g>`;
    }
    function egg(cx,cy,size,local,type) {
      const points=Array.from({length:56},(_,i)=>{
        const theta=i/56*Math.PI*2,radius=(.37+.12*(Math.sin(theta)+1)/2)*size;
        return [cx+Math.cos(theta)*radius,cy+Math.sin(theta)*size*.49];
      });
      if(type===2) {
        const white=ovalPoints(cx,cy,size*.52,size*.35,local,.12).map((p,i)=>[p[0]+Math.sin(i*.9)*size*.035,p[1]+Math.cos(i*.7)*size*.04]);
        return `<g data-egg-pattern="fried">${polygon(white,.05)}${contour(white,local,.1,.75)}${oval(cx+size*.04,cy-size*.02,size*.19,size*.17,local+23,0,.8)}${polygon(ovalPoints(cx+size*.04,cy-size*.02,size*.17,size*.15,local+41),.16)}</g>`;
      }
      const crack=type===1?curve([[cx-size*.3,cy-size*.02],[cx-size*.1,cy-size*.12],[cx,cy+size*.03],[cx+size*.17,cy-size*.08],[cx+size*.35,cy+size*.04]],local+37,.7,.8):"";
      const spots=type===3?[[-.17,.05],[.13,.2],[.12,-.2]].map(([u,v],i)=>polygon(ovalPoints(cx+size*u,cy+size*v,size*.035,size*.065,local+i),.6)).join(""):"";
      return `<g data-egg-pattern="${type===1?"cracked":type===3?"speckled":"whole"}">${polygon(points,.05)}${contour(points,local,.1,.8)}${crack}${spots}</g>`;
    }
    function eggs() {
      return `<g data-monster-motif="eggs">${cells.map(cell=>{
        const [x,y]=origin(cell),s=seed+cell*43;
        return glyph("蛋",[x+8,y+5,43,43],s,1.2,-.12)+egg(x+72,y+30,39,s+31,Math.floor(rand(7,s)*4))
          +egg(x+29,y+74,39,s+57,Math.floor(rand(11,s)*4))+glyph("蛋",[x+52,y+53,40,40],s+83,1.1,.12);
      }).join("")}</g>`;
    }
    function dense(text,kind,{pool=null,messy=false,textMode=false,compact=false}={}) {
      const regions=h.regions(cells,board.cols),letters=[...text],pitch=compact?.68:.91;
      return `<g data-monster-motif="${kind}" data-special-text="${text}" data-dense-layout="continuous"${compact?' data-dense-compact="true"':''}>${regions.map((region,regionIndex)=>{
        const minX=Math.min(...region.map(col))*100,maxX=(Math.max(...region.map(col))+1)*100;
        const minY=Math.min(...region.map(row))*100,maxY=(Math.max(...region.map(row))+1)*100;
        const blood=text==="血",localSeed=seed+region[0]*43,baseSize=blood?29:24,lines=[];
        let lineIndex=0;
        for(let baseline=minY-baseSize;baseline<maxY+baseSize;baseline+=baseSize*((blood ? .62 : messy ? .9 : .98)+rand(lineIndex+7,localSeed)*(blood ? .28 : messy ? .2 : .14)),lineIndex++) {
          const lineSeed=localSeed+lineIndex*71,slope=(rand(11,lineSeed)-.5)*(blood ? .32 : messy ? .2 : .12);
          let cursor=minX-baseSize*(.4+rand(17,lineSeed)*(blood?2:messy?.8:1.2)),wordIndex=0;
          const wordMarks=[];
          while(cursor<maxX+baseSize) {
            const size=baseSize*((blood ? .75 : messy ? .92 : .88)+rand(wordIndex+23,lineSeed)*(blood ? .52 : messy ? .2 : .24)),angle=Math.atan(slope)+(rand(wordIndex+47,lineSeed)-.5)*(blood ? .42 : messy ? .22 : .12);
            const y=baseline+(cursor-minX)*slope+(rand(wordIndex+59,lineSeed)-.5)*(blood?13:messy?5:3);
            const word=pool?[pool[Math.floor(rand(wordIndex+107,lineSeed)*pool.length)]]:letters;
            wordMarks.push(textMode
              ? brushWordMark(word,cursor,y,size,angle,.95)
              : word.map((char,k)=>glyph(char,[cursor+k*size*pitch,y,size,size],lineSeed+wordIndex*31+k*19,text==="血"?1.9:1.7,angle)).join(""));
            cursor+=size*(blood ? Math.max(.58,word.length*.58)+rand(wordIndex+83,lineSeed)*.2
              : messy ? word.length*(.92+rand(wordIndex+83,lineSeed)*.22)+.05
                : word.length*pitch+(compact?.06:.1)+rand(wordIndex+83,lineSeed)*(compact?.12:.18));wordIndex++;
          }
          lines.push(`<g data-dense-line="${regionIndex}:${lineIndex}">${wordMarks.join("")}</g>`);
        }
        return `<g data-dense-region="${region.join(",")}">${lines.join("")}</g>`;
      }).join("")}</g>`;
    }

    function mud() {
      const outline=[[21,86],[11,81],[10,71],[17,63],[27,60],[22,54],[24,45],[36,40],
        [35,33],[43,26],[48,18],[47,8],[59,13],[66,22],[65,30],[74,35],[79,44],
        [75,53],[87,60],[92,69],[90,79],[80,86],[21,86]];
      const layouts=[
        [[32,29,47],[78,30,29],[62,68,43],[20,79,26],[81,85,24]],
        [[66,30,48],[23,38,35],[40,78,39],[81,74,28],[44,13,23]],
        [[42,52,51],[19,17,27],[78,23,33],[81,70,31],[29,86,24],[65,91,21]]
      ];
      return `<g data-monster-motif="mud-poop">${cells.map(cell=>{
        const [x,y]=origin(cell),s=seed+cell*43,layout=layouts[Math.floor(rand(19,s)*layouts.length)];
        return `<g data-poop-cell="${cell}">${layout.map(([px,py,baseSize],i)=>{
          const local=s+i*47,size=baseSize*(.92+rand(23,local)*.16),angle=rand(31,local)*Math.PI*2;
          const corners=[[-43,-46],[46,-46],[-43,43],[46,43]].map(([u,v])=>[
            (u*Math.cos(angle)-v*Math.sin(angle))*size/100,(u*Math.sin(angle)+v*Math.cos(angle))*size/100]);
          const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
          const cx=Math.max(5-Math.min(...xs),Math.min(95-Math.max(...xs),px+(rand(41,local)-.5)*8));
          const cy=Math.max(5-Math.min(...ys),Math.min(95-Math.max(...ys),py+(rand(53,local)-.5)*8));
          const face=rand(61,local)>.45?polygon(ovalPoints(35,65,3,4,local+11),.9)
            +polygon(ovalPoints(63,65,3,4,local+17),.9)+curve([[35,75],[48,80],[62,74]],local+29,.65,.9):"";
          const marks=polygon(outline,.08)+curve(outline,local,1.2,.95)
            +curve([[20,62],[41,65],[61,62],[78,57]],local+7,.8,.85)
            +curve([[33,41],[49,45],[65,42],[73,38]],local+19,.75,.85)+face;
          return `<g data-poop-symbol="true" data-poop-size="${size.toFixed(2)}" data-poop-angle="${(angle*180/Math.PI).toFixed(2)}" transform="translate(${x+cx} ${y+cy}) rotate(${angle*180/Math.PI}) scale(${size/100}) translate(-50 -50)">${marks}</g>`;
        }).join("")}</g>`;
      }).join("")}</g>`;
    }

    const SHI_POOL=Object.freeze(["食","屎","尸","十","石","师","士","是","世","失","时","事","市","视","试","室","诗"]);
    let content,strongDense=false;
    if(id==="M_Toadragon")content=toad();
    else if(id==="M_YoungDevour") {
      const variant=Math.floor(rand(223)*4);
      strongDense=variant!==0;
      content=variant===0?teeth():variant===1?dense("吃","dense-eat")
        :variant===2?dense("肉肉","dense-meat"):dense("嚼","dense-chew");
    }
    else if(id==="M_PuppetKing") {
      const phrases=["五指不行!","如来神掌!","!冲击波!"];
      content=cellPhrase(phrases[Math.floor(rand(113)*phrases.length)],seed+71);
    } else if(id==="M_DevilSmeltedFears")content=spear();
    else if(id==="M_Eggknight")content=eggs();
    else if(id==="M_Knighteater") {
      const variant=Math.floor(rand(313)*3);
      content=variant===0?dense("好吃","dense-tasty")
        :variant===1?dense("shi","dense-shi",{compact:true})
          :dense("读音shi","dense-shi-random",{pool:SHI_POOL,messy:true});
    }
    else if(id==="M_PalebloodWorms")content=dense("血","dense-blood");
    else if(id==="M_KnightFen") {
      // Mud-knight lettering is drawn with the same pen strokes as every other boss
      // (see 吃/血/好吃); the brush-font outlines stay for the latin "shi" jokes only.
      const variant=Math.floor(rand(337)*3);
      strongDense=variant!==0;
      content=variant===0?mud()
        :variant===1?dense("FEN!","mud-fen-abbr")
          :dense("粪！","mud-fen-cn");
    }
    else if(id==="M_KingLaidLow") {
      const phrases=["椅子能坐","骇物牛逼","开放世界","FUFU王","好想玩XX"];
      const strip=runs((Number(options.attackFacing)||0)%180!==0)[0];
      content=runWord(phrases[Math.floor(rand(127)*phrases.length)],strip,seed+131,84);
    }
    return `<g class="ink-warning ink-monster-special"${strongDense||["M_Knighteater","M_PalebloodWorms"].includes(id)?' style="opacity:.96"':id==="M_Toadragon"?' style="opacity:.9"':""} data-monster-ink="${id}" data-monster-cells="${cells.join(",")}">${content}</g>`;
  }

  window.KFEncounterMonsterInk = Object.freeze({ render });
})();
