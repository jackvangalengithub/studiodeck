// Deliberately limited HTML builder. Strings are always text, never markup.
// Keep tags and prop names in application code; pass user data only as values.
const tags=new Set('a abbr article aside b blockquote br button caption code col colgroup datalist dd details dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input label legend li main mark nav ol optgroup option output p picture pre progress s section select small source span strong sub summary sup table tbody td textarea tfoot th thead time tr u ul video audio'.split(' '));
const attributes=new Set('id class for title role name type value placeholder autocomplete accept min max step minlength maxlength pattern rows cols width height tabindex colspan rowspan scope datetime dir lang alt loading decoding controls loop muted playsinline preload poster href src target rel download action method enctype checked selected disabled readonly required multiple hidden open inert autofocus'.split(' '));
const booleans=new Set('controls loop muted playsinline checked selected disabled readonly required multiple hidden open inert autofocus'.split(' '));
const urls=new Set(['href','src','poster','action']);

function safeUrl(value,attribute){
 const text=String(value),parsed=new URL(text,document.baseURI);
 const allowed=attribute==='href'?['http:','https:','mailto:','tel:']:['http:','https:'];
 if((attribute==='src'||attribute==='poster')&&parsed.protocol==='blob:'&&parsed.origin===location.origin)return text;
 if(!allowed.includes(parsed.protocol))throw new TypeError(`Unsafe ${attribute} URL`);
 return text;
}

/** e('div', {className:'title'}, [e('strong', {}, name), ' details']) */
export function e(tag,props={},children=[]){
 if(typeof tag!=='string'||!tags.has(tag))throw new TypeError('Unsupported element');
 const node=document.createElement(tag);
 for(const [name,value] of Object.entries(props||{})){
  if(name==='on'){
   if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected event listeners');
   for(const [event,listener] of Object.entries(value)){
    if(!/^[a-z][a-z0-9-]*$/.test(event)||typeof listener!=='function')throw new TypeError('Event listeners must be functions');
    node.addEventListener(event,listener);
   }
   continue;
  }
  const attr=({className:'class',htmlFor:'for',tabIndex:'tabindex',readOnly:'readonly'})[name]||name;
  if(!attributes.has(attr)&&!/^data-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(attr)&&!/^aria-[a-z]+(?:-[a-z]+)*$/.test(attr))throw new TypeError(`Unsupported prop: ${name}`);
  if(value==null)continue;
  if(!['string','number','boolean','bigint'].includes(typeof value))throw new TypeError(`Invalid prop value: ${name}`);
  if(booleans.has(attr)){if(value)node.setAttribute(attr,'');continue;}
  node.setAttribute(attr,urls.has(attr)?safeUrl(value,attr):String(value));
 }
 if(node.getAttribute('target')==='_blank'){
  const rel=new Set((node.getAttribute('rel')||'').split(/\s+/).filter(Boolean));rel.add('noopener');node.setAttribute('rel',[...rel].join(' '));
 }
 const append=child=>{
  if(child==null||typeof child==='boolean')return;
  if(Array.isArray(child)){for(const value of child)append(value);return;}
  if(child instanceof Node){node.append(child);return;}
  if(['string','number','bigint'].includes(typeof child)){node.append(document.createTextNode(String(child)));return;}
  throw new TypeError('Children must be text, nodes or arrays');
 };
 append(children);
 if(props?.value!=null&&'value' in node){
  if(tag==='textarea')node.defaultValue=String(props.value);
  node.value=String(props.value);
 }
 return node;
}
