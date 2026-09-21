<?php
declare(strict_types=1);

// Page IDs and source filenames stay stable when public addresses change.
function website_page_file(string $id,string $extension='html'): string {
    return $id==='home'&&$extension==='html'?'index.html':'pages/'.$id.'.'.$extension;
}
function website_with_pages(array $d): array {
    if(!isset($d['pages']))$d['pages']=[['id'=>'home','name'=>'Home','slug'=>'','navigation'=>true,'kind'=>'custom','project'=>'']];
    if(isset($d['files']['header.html']))foreach($d['pages'] as $page)foreach(['css','js'] as $ext)$d['files'][website_page_file($page['id'],$ext)]??='';
    return $d;
}
function website_pages_clean(array $pages,array $files,array $projects): array {
    $out=[];$ids=[];$slugs=[];$home=0;$linked=[];
    foreach(website_array($pages,100) as $p){
        if(!is_array($p))fail('Choose valid website pages.');
        $id=text_field($p['id']??'',32);$name=text_field($p['name']??'',120);$slug=text_field($p['slug']??'',120);
        if(($id!=='home'&&!preg_match('/^[a-f0-9]{32}$/D',$id))||isset($ids[$id])||!$name)fail('Every page needs a unique ID and a name.');
        if($id==='home'){if($slug!=='')fail('Home must keep the website’s root address.');$home++;}
        elseif(!preg_match('~^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$~D',$slug)||preg_match('~^(?:assets|pages|api|sites)(?:/|$)~',$slug))fail('Use an address such as contact or projects/your-project.');
        if(isset($slugs[$slug]))fail('Another page already uses this address.');
        $kind=$p['kind']??'custom';if(!in_array($kind,['custom','about','contact','projects','project'],true))fail('Choose a valid page type.');
        $project=text_field($p['project']??'',32);
        if($kind==='project'){
            if($id==='home')fail('Home cannot be a project detail page.');
            if(!in_array($project,array_column($projects,'id'),true)||isset($linked[$project]))fail('Choose a connected project without an existing detail page.');
            $linked[$project]=true;
        }elseif($project!=='')fail('Only project detail pages can be linked to a project.');
        if(!isset($files[website_page_file($id)])||!trim($files[website_page_file($id)]))fail('Keep the source for every page.');
        $ids[$id]=true;$slugs[$slug]=true;$out[]=['id'=>$id,'name'=>$name,'slug'=>$slug,'navigation'=>!empty($p['navigation']),'kind'=>$kind,'project'=>$project];
    }
    if($home!==1)fail('Keep one Home page.');
    foreach(array_keys($files) as $file)if(preg_match('~^pages/(home|[a-f0-9]{32})\.(html|css|js)$~D',$file,$m)&&!isset($ids[$m[1]]))fail('Remove source files for deleted pages.');
    if(count($out)>1&&(!isset($files['header.html'])||!isset($files['footer.html'])))fail('Keep the shared header and footer.');
    return $out;
}
function website_page_enabled(array $d,array $page): bool {
    if($page['kind']!=='project')return true;
    foreach($d['projects'] as $p)if($p['id']===$page['project'])return (bool)$p['included'];
    return false;
}
function website_page_find(array $d,string $id): array {
    foreach($d['pages'] as $page)if($page['id']===$id)return $page;
    fail('Website page not found.',404);
}
function website_page_url(array $page): string {return $page['slug']===''?'/':'/'.$page['slug'].'/';}
function website_page_output(array $page): string {return $page['slug']===''?'index.html':$page['slug'].'/index.html';}
function website_project_page(array $d,string $project): ?array {
    foreach($d['pages'] as $page)if($page['kind']==='project'&&$page['project']===$project&&website_page_enabled($d,$page))return $page;
    return null;
}
function website_node_html(DOMNode $node): string {return $node->ownerDocument->saveHTML($node);}
function website_fragment_set(DOMNode $node,string $html): void {
    $dom=$node->ownerDocument;while($node->firstChild)$node->removeChild($node->firstChild);
    $fragment=website_source_document('<html><body>'.$html.'</body></html>');
    foreach(iterator_to_array($fragment->getElementsByTagName('body')->item(0)->childNodes) as $child)$node->appendChild($dom->importNode($child,true));
}
function website_enable_layout(array $d): array {
    if(isset($d['files']['header.html']))return $d;
    $dom=website_source_document($d['files']['index.html']);$xp=new DOMXPath($dom);$body=$dom->getElementsByTagName('body')->item(0);
    if(!$body||!$dom->getElementsByTagName('main')->length)fail('Add a main content element to Home before creating more pages.');
    $header=$xp->query('(//header[not(ancestor::main)])[1]')->item(0);
    if(!$header){$header=$dom->createElement('header');$header->setAttribute('class','site-header');website_fragment_set($header,'<a class="brand" href="/">'.website_html($d['name']).'</a><nav aria-label="Main navigation"></nav>');$body->insertBefore($header,$body->firstChild);}
    $nav=$header->getElementsByTagName('nav')->item(0);if(!$nav){$nav=$dom->createElement('nav');$header->appendChild($nav);}
    $nav->setAttribute('data-website-navigation','');$nav->setAttribute('aria-label','Main navigation');website_fragment_set($nav,'<!-- Links are managed in Pages. -->');
    foreach($header->getElementsByTagName('a') as $link){$href=$link->getAttribute('href');if($href==='#main')$link->setAttribute('href','/');elseif(str_starts_with($href,'#'))$link->setAttribute('href','/'.$href);}
    $footer=$xp->query('(//footer[not(ancestor::main)])[last()]')->item(0);
    if(!$footer){$footer=$dom->createElement('footer');$footer->setAttribute('class','site-footer');$footer->appendChild($dom->createTextNode($d['name']));$body->appendChild($footer);}
    foreach($footer->getElementsByTagName('a') as $link){$href=$link->getAttribute('href');if($href!=='#main'&&str_starts_with($href,'#'))$link->setAttribute('href','/'.$href);}
    foreach(['header'=>$header,'footer'=>$footer] as $name=>$node){$d['files'][$name.'.html']=website_node_html($node);$node->parentNode->replaceChild($dom->createComment(' website:'.$name.' '),$node);}
    // Inline styles authored on the original Home page become shared styles too.
    foreach(iterator_to_array($xp->query('//head/style')) as $style){$d['files']['styles.css'].="\n".$style->textContent;$style->parentNode->removeChild($style);}
    $d['files']['index.html']=$dom->saveHTML();
    $d['files']['pages/home.css']='';$d['files']['pages/home.js']=$d['files']['script.js'];$d['files']['script.js']='';
    $d['files']['styles.css'].="\n/* Shared navigation */\n[data-website-navigation]{min-width:0}.website-nav-toggle{display:none}.website-navigation-links{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.website-navigation-links [aria-current=page]{text-decoration:underline;text-underline-offset:6px}@media(max-width:700px){[data-website-navigation]{width:100%}.website-nav-toggle{display:block;padding:10px 14px;background:transparent;border:1px solid currentColor;color:inherit;font:inherit;cursor:pointer}.website-navigation-links{display:none;padding:16px 0;align-items:flex-start;flex-direction:column;gap:14px}[data-website-navigation][data-open] .website-navigation-links{display:flex}}\n";
    return $d;
}
function website_page_document(array $d,string $name,string $content): string {
    $home=website_source_document($d['files']['index.html']);$class=trim($home->getElementsByTagName('body')->item(0)?->getAttribute('class')??'');$e='website_html';
    return '<!doctype html><html lang="'.$d['language'].'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.$e($name.' | '.$d['name']).'</title><meta name="description" content=""><link rel="stylesheet" href="styles.css"><script src="script.js" defer></script></head><body class="'.$e($class).'" data-website-theme="'.$e($class).'"><a class="skip" href="#main">Skip to content</a><!-- website:header --><main id="main">'.$content.'</main><!-- website:footer --></body></html>';
}
function website_page_seed(array $d,string $kind,string $name,string $project=''): string {
    $e='website_html';$heading='<section class="work"><div class="section-heading"><h1>'.$e($name).'</h1></div>';
    return match($kind){
        'about'=>$heading.'<p>'.$e($d['about']?:$d['intro']).'</p></section>',
        'contact'=>$heading.($d['email']?'<p><a class="contact-link" href="mailto:'.$e($d['email']).'">'.$e($d['email']).'</a></p>':'<p>Add your contact details here.</p>').'</section>',
        'projects'=>$heading.'<div class="work-grid" data-website-projects></div></section>',
        'project'=>'<div data-website-project-detail="'.$e($project).'"></div>',
        default=>$heading.'</section>',
    };
}
// Source links are site-relative; emitted links are relative to the exported page.
function website_resolve_page_link(string $url,array $pages,string $current='home'): ?array {
    if(preg_match('~^(?:https?://|mailto:|tel:)~i',$url))return null;
    if(str_starts_with($url,'#'))return ['id'=>$current,'fragment'=>substr($url,1)];
    if(str_starts_with($url,'//')||str_contains($url,'?')||str_contains($url,'..')||str_contains($url,'\\'))return null;
    [$path,$fragment]=array_pad(explode('#',$url,2),2,'');$path=trim($path,'/');if($path==='index.html')$path='';
    foreach($pages as $page)if($path===$page['slug']||$path===($page['slug']?$page['slug'].'/index.html':'index.html')||$path===website_page_file($page['id']))return ['id'=>$page['id'],'fragment'=>$fragment];
    return null;
}
function website_rewrite_page_links(array $d,array $previous,string $id,bool $deleted=false): array {
    $target=$deleted?website_page_find($d,'home'):website_page_find($d,$id);
    foreach($d['files'] as $file=>$text)if(str_ends_with($file,'.html')){
        $d['files'][$file]=preg_replace_callback('~\bhref\s*=\s*([\'"])(.*?)\1~is',function($m)use($previous,$id,$target,$deleted){
            if(str_starts_with($m[2],'#'))return $m[0];$link=website_resolve_page_link(html_entity_decode($m[2],ENT_QUOTES,'UTF-8'),$previous);
            if(!$link||$link['id']!==$id)return $m[0];return 'href='.$m[1].website_html(website_page_url($target).(!$deleted&&$link['fragment']!==''?'#'.$link['fragment']:'')).$m[1];
        },$text);
    }
    return $d;
}
function website_page_change(array $u,array $b): array {
    $site=website_get($u['studio_id']);if((int)$site['revision']!==(int)($b['revision']??0))fail('Reload the latest draft before changing pages.',409);
    $d=website_with_source(json_decode($site['draft'],true));$operation=$b['operation']??'';$id=text_field($b['id']??'',32);$before=$d['pages'];
    if($operation==='add'||$operation==='duplicate'){
        if(count($d['pages'])>=100)fail('This website already has 100 pages.');
        $d=website_enable_layout($d);$source=$operation==='duplicate'?website_page_find($d,$id):null;if($source&&$source['kind']==='project')fail('This project already has a detail page. Duplicate a regular page instead.');
        $name=text_field($b['name']??'',120);$slug=text_field($b['slug']??'',120);$kind=$source?'custom':($b['kind']??'custom');$project=text_field($b['project']??'',32);$id=id();
        if($kind==='project'&&!in_array($project,array_column($d['projects'],'id'),true))fail('Choose a connected project.');
        $d['pages'][]=['id'=>$id,'name'=>$name,'slug'=>$slug,'kind'=>$kind,'project'=>$kind==='project'?$project:'','navigation'=>$kind!=='project'&&!empty($b['navigation'])];
        $d['files'][website_page_file($id)]=$source?$d['files'][website_page_file($source['id'])]:website_page_document($d,$name,website_page_seed($d,$kind,$name,$project));
        foreach(['css','js'] as $ext)$d['files'][website_page_file($id,$ext)]=$source?($d['files'][website_page_file($source['id'],$ext)]??''):'';
        if($source){$dom=website_source_document($d['files'][website_page_file($id)]);if($source['id']==='home'){$body=$dom->getElementsByTagName('body')->item(0);$body?->setAttribute('data-website-theme',$body->getAttribute('class'));}$title=$dom->getElementsByTagName('title')->item(0);if($title)$title->textContent=$name.' | '.$d['name'];$d['files'][website_page_file($id)]=$dom->saveHTML();}
    }else{
        $page=website_page_find($d,$id);$index=array_search($id,array_column($d['pages'],'id'),true);
        if($operation==='update'){
            $d['pages'][$index]['name']=text_field($b['name']??'',120);$d['pages'][$index]['slug']=$id==='home'?'':text_field($b['slug']??'',120);$d['pages'][$index]['navigation']=!empty($b['navigation']);
            $file=website_page_file($id);$dom=website_source_document($d['files'][$file]);$title=$dom->getElementsByTagName('title')->item(0);if($title&&$title->textContent===$page['name'].' | '.$d['name']){$title->textContent=$d['pages'][$index]['name'].' | '.$d['name'];$d['files'][$file]=$dom->saveHTML();}
            $d=website_rewrite_page_links($d,$before,$id);
        }elseif($operation==='move'){
            $to=$index+(int)($b['direction']??0);if(abs($to-$index)!==1||$to<0||$to>=count($d['pages']))fail('Choose an adjacent page position.');
            [$d['pages'][$index],$d['pages'][$to]]=[$d['pages'][$to],$d['pages'][$index]];
        }elseif($operation==='delete'){
            if($id==='home')fail('Keep the Home page.');$d['pages']=array_values(array_filter($d['pages'],fn($p)=>$p['id']!==$id));
            foreach(['html','css','js'] as $ext)unset($d['files'][website_page_file($id,$ext)]);
            $d=website_rewrite_page_links($d,$before,$id,true);$id='home';
        }else fail('Choose a valid page action.');
    }
    website_save($u,$d,(int)$site['revision']);return ['website'=>website_payload($u),'page'=>$id];
}
function website_page_materials(array $d,array $page,DOMDocument $dom): void {
    $xp=new DOMXPath($dom);
    foreach(iterator_to_array($xp->query('//*[@data-website-projects]')) as $grid){$html='';foreach($d['projects'] as $p)if($p['included']){
        $detail=website_project_page($d,$p['id']);$href=$detail?website_page_url($detail):'/#project-'.$p['id'];
        $html.='<a class="work-card" data-project-card="'.$p['id'].'" href="'.website_html($href).'">'.website_source_image($p['images'][0]['asset']??'',$p['images'][0]['alt']??$p['title']).'<span>'.website_html($p['category']).'</span><h3>'.website_html($p['title']).' ↗</h3></a>';
    }website_fragment_set($grid,$html?:'<p class="empty-work">A collection of our work is coming soon.</p>');}
    foreach(iterator_to_array($xp->query('//*[@data-website-project-detail]')) as $node){$id=$node->getAttribute('data-website-project-detail');$html='';foreach($d['projects'] as $p)if($p['id']===$id&&$p['included']){
        $html=website_source_project($p);$html=preg_replace('~<h2>(.*?)</h2>~s','<h1>$1</h1>',$html,1);$quotes='';foreach($d['testimonials'] as $t)if($t['project']===$id&&website_testimonial_enabled($d,$t)&&$t['placement']!=='home')$quotes.=website_source_testimonial($t);$html=substr($html,0,-10).$quotes.'</section>';
    }website_fragment_set($node,$html);}
    foreach($d['projects'] as $p){$detail=website_project_page($d,$p['id']);
        if($detail){
            foreach($xp->query('//a[@href="#project-'.$p['id'].'" or @href="/#project-'.$p['id'].'"]') as $link)$link->setAttribute('href',website_page_url($detail));
            if($page['id']!==$detail['id'])foreach(iterator_to_array($xp->query('//*[@data-project="'.$p['id'].'"]')) as $node)$node->parentNode->removeChild($node);
        }
    }
}
function website_page_files(array $d,array $page): array {
    $files=$d['files'];$html=$files[website_page_file($page['id'])];$shared=isset($files['header.html']);
    if($shared)$html=preg_replace_callback('~<!--\s*website:(header|footer)\s*-->~',fn($m)=>$files[$m[1].'.html'],$html);
    $dom=website_source_document($html);$xp=new DOMXPath($dom);$body=$dom->getElementsByTagName('body')->item(0);
    if($body){$body->setAttribute('data-website-page',$page['id']);if($shared&&$page['id']!=='home'){$home=website_source_document($files['index.html']);$theme=$home->getElementsByTagName('body')->item(0)?->getAttribute('class')??'';$local=array_diff(explode(' ',$body->getAttribute('class')),explode(' ',$body->getAttribute('data-website-theme')));$body->setAttribute('class',trim(implode(' ',array_unique(array_filter([...explode(' ',$theme),...$local])))));$body->removeAttribute('data-website-theme');}}
    foreach($xp->query('//*[@data-website-navigation]') as $nav){$links='';foreach($d['pages'] as $p)if($p['navigation']&&website_page_enabled($d,$p))$links.='<a href="'.website_html(website_page_url($p)).'"'.($p['id']===$page['id']?' aria-current="page"':'').'>'.website_html($p['name']).'</a>';
        website_fragment_set($nav,'<button type="button" class="website-nav-toggle" aria-expanded="false">Menu</button><div class="website-navigation-links">'.$links.'</div>');
    }
    if($page['kind']==='project')foreach($d['projects'] as $project)if($project['id']===$page['project']){$title=$dom->getElementsByTagName('title')->item(0);if($title)$title->textContent=$project['title'].' | '.$d['name'];foreach($xp->query('//meta[@name="description"]') as $meta)$meta->setAttribute('content',mb_substr($project['description'],0,160));}
    website_page_materials($d,$page,$dom);
    $html=$dom->saveHTML();
    return ['index.html'=>$html,'styles.css'=>$files['styles.css']."\n".($files[website_page_file($page['id'],'css')]??''),'script.js'=>$files['script.js']."\n;\n".($files[website_page_file($page['id'],'js')]??'')];
}
function website_all_checks(string $sid,array $d): array {
    $errors=[];$warnings=[];$prepared=[];$anchors=[];
    foreach($d['pages'] as $page)if(website_page_enabled($d,$page)){
        $files=website_page_files($d,$page);$prepared[$page['id']]=$files;$dom=website_source_document($files['index.html']);$xp=new DOMXPath($dom);$anchors[$page['id']]=[];foreach($xp->query('//*[@id]') as $node)$anchors[$page['id']][]=$node->getAttribute('id');
    }
    foreach($d['pages'] as $page)if(isset($prepared[$page['id']])){
        $files=$prepared[$page['id']];$checks=website_source_checks($sid,$files,$d['pages'],$page['id'],$anchors);
        $raw=$d['files'][website_page_file($page['id'])];if(!preg_match('~<html\b~i',$raw)||!preg_match('~<body\b~i',$raw))$checks['errors'][]='Keep a complete HTML document with html and body elements.';
        if(isset($d['files']['header.html']))foreach(['header','footer'] as $part)if(!preg_match('~<!--\s*website:'.$part.'\s*-->~',$d['files'][website_page_file($page['id'])]))$checks['errors'][]='Keep the shared '.$part.' marker in this page.';
        foreach($checks['errors'] as $error)$errors[]=$page['name'].': '.$error;foreach($checks['warnings'] as $warning)$warnings[]=$page['name'].': '.$warning;
    }
    return ['errors'=>array_values(array_unique($errors)),'warnings'=>array_values(array_unique($warnings))];
}
function website_page_assets(array $d): array {
    $files=[];foreach($d['pages'] as $page)if(website_page_enabled($d,$page))foreach(website_page_files($d,$page) as $name=>$source)$files[$page['id'].'/'.$name]=$source;
    return $files;
}
function website_navigation_script(): string {
    return 'document.addEventListener("click",function(e){const b=e.target.closest(".website-nav-toggle");if(b){const nav=b.closest("[data-website-navigation]");const open=!nav.hasAttribute("data-open");nav.toggleAttribute("data-open",open);b.setAttribute("aria-expanded",String(open));}});';
}
function website_compile_page(array $d,array $assets,string $origin,array $page,bool $preview=false,string $channel=''): array {
    $single=$d;$single['files']=website_page_files($d,$page);$prefix=str_repeat('../',$page['slug']===''?0:substr_count($page['slug'],'/')+1);
    $dom=website_source_document($single['files']['index.html']);$xp=new DOMXPath($dom);
    foreach($xp->query('//a[@href]') as $link){$resolved=website_resolve_page_link($link->getAttribute('href'),$d['pages'],$page['id']);if(!$resolved)continue;
        $target=website_page_find($d,$resolved['id']);$fragment=$resolved['fragment'];
        if($resolved['id']===$page['id']&&str_starts_with($link->getAttribute('href'),'#'))continue;
        if($preview){$link->setAttribute('href',$fragment!==''?'#'.$fragment:'#');$link->setAttribute('data-website-page-link',$target['id']);$link->setAttribute('data-website-fragment',$fragment);}
        else $link->setAttribute('href',$prefix.($target['slug']!==''?$target['slug'].'/':'index.html').($fragment!==''?'#'.$fragment:''));
    }
    $single['files']['index.html']=$dom->saveHTML();$single['files']['script.js'].="\n".website_navigation_script();
    if($preview)$single['files']['script.js'].=';document.addEventListener("click",function(e){const a=e.target.closest("a[data-website-page-link]");if(a){e.preventDefault();parent.postMessage({type:"website-page-navigation",page:a.dataset.websitePageLink,fragment:a.dataset.websiteFragment,channel:'.json_encode($channel).'},"*");}});';
    return website_source_compile($single,$assets,$origin,$preview,$channel,website_page_url($page),$preview?'':$prefix);
}
function website_sync_materials(array $before,array $after): array {
    $old=website_with_source($before);
    foreach($after['pages'] as &$page){
        if($page['kind']==='project'){
            $a=array_column($old['projects'],null,'id')[$page['project']]??null;$b=array_column($after['projects'],null,'id')[$page['project']]??null;
            if($a&&$b&&$page['name']===$a['title'])$page['name']=$b['title'];
        }
        $file=website_page_file($page['id']);
        if(!isset($old['files'][$file])||$old['files'][$file]!==$after['files'][$file]||in_array($page['kind'],['project','projects'],true))continue;
        $a=$old;$b=$after;$a['files']=['index.html'=>$old['files'][$file],'styles.css'=>'','script.js'=>''];$b['files']=$a['files'];
        $synced=website_sync_materials_document($a,$b,$page['id']==='home');$after['files'][$file]=$synced['files']['index.html'];
    }
    unset($page);return $after;
}
