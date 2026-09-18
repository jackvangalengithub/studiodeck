<?php
require __DIR__.'/../app/youtube.php';
$id='M7lc1UVf-VE';
$valid=['https://www.youtube.com/watch?v='.$id,'https://youtu.be/'.$id.'?si=ignored','https://youtube.com/shorts/'.$id,'https://m.youtube.com/live/'.$id,'https://www.youtube-nocookie.com/embed/'.$id,'youtube.com/watch?v='.$id,'https://music.youtube.com/watch?v='.$id.'&list=ignored'];
foreach($valid as $url){$video=youtube_video($url);if(($video['id']??'')!==$id)throw new Exception('Rejected valid video: '.$url);}
$invalid=['https://vimeo.com/'.$id,'https://youtube.com.evil.test/watch?v='.$id,'https://youtube.com@evil.test/watch?v='.$id,'https://evil.test@youtube.com/watch?v='.$id,'javascript:alert(1)','data:text/html,bad','https://youtube.com:444/watch?v='.$id,'https://youtube.com/playlist?list=abc','https://youtube.com/watch?v[]=abc','https://youtu.be/short','https://youtube.com/watch?v='.$id.'more','https://youtube.com/embed/'.$id.'/extra',"https://youtube.com\\@evil.test/watch?v=".$id,"https://youtu.be/".$id."\nmore"];
foreach($invalid as $url)if(youtube_video($url)!==null)throw new Exception('Accepted invalid URL: '.$url);
if(youtube_video('https://youtu.be/'.$id.'?t=1h2m3s')['start']!==3723)throw new Exception('Timestamp parsing failed');
if(youtube_video('https://youtu.be/'.$id.'?start=999999')['start']!==86400)throw new Exception('Unbounded timestamp');
echo "PASS YouTube watch/share/Shorts/live links, normalized timestamps, strict host and video validation.\n";
