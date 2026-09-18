<?php
require __DIR__.'/../app/comments.php';
$db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec("CREATE TABLE comments(id TEXT PRIMARY KEY,iteration_id TEXT,slide TEXT,author TEXT,body TEXT,created_at TEXT); INSERT INTO comments VALUES('legacy','iteration','intro','a@example.test','Original comment','2020-01-01');");
migrate_comment_threads($db);migrate_comment_threads($db);
$row=$db->query('SELECT * FROM comments')->fetch();if($row['body']!=='Original comment'||$row['parent_id']!==null||(int)$row['answered']!==0)throw new RuntimeException('Migration changed an existing comment');
echo "PASS existing comments survive migration; migration is repeatable.\n";
