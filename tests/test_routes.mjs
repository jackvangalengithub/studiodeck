import assert from 'node:assert/strict';
import {readWorkspaceRoute,workspaceUrl} from '../public/assets/routes.js';
const parse=path=>readWorkspaceRoute(new URL(path,'http://localhost:8199'));
assert.deepEqual(parse('/200/projects/p123?iteration=i2&tab=files'),{studioId:'200',view:'project',projectId:'p123',iteration:'i2',tab:'files',search:'',archived:false});
assert.equal(workspaceUrl({studioId:'200',view:'slide',slide:'visual-x',projectId:'p123',iteration:'i2'}),'/200/slide/visual-x?project=p123&iteration=i2');
assert.equal(parse('/300/slide/visual-x?project=p123&iteration=i2').studioId,'300');
assert.equal(parse('/200/projects?search=Living+room&archived=1').search,'Living room');
assert.equal(parse('/200/projects?archived=1').archived,true);
for(const [view,path] of [['studio-users','users'],['all-comments','comments'],['all-activity','activity'],['settings','settings']])assert.equal(parse(workspaceUrl({studioId:'200',view})).view,view);
assert.equal(parse('/'),null);assert.equal(parse('/assets/app.js'),null);
assert.equal(parse('/200/projects/p123?tab=invalid').tab,'overview');
assert.equal(parse('/client/projects/p123'),null);
console.log('PASS Studio-scoped URLs preserve projects, tabs, iterations, slides, feeds, search and archive filters.');

assert.equal(readWorkspaceRoute({pathname:'/studio/projects/project',search:'?tab=people'}).tab,'people');

assert.deepEqual(parse('/200/website?edit=1'),{studioId:'200',view:'website',editing:true});
assert.deepEqual(parse('/200/website'),{studioId:'200',view:'website',editing:false});
assert.equal(workspaceUrl({studioId:'200',view:'website',websiteEditing:true}),'/200/website?edit=1');
assert.equal(workspaceUrl({studioId:'200',view:'website',websiteEditing:false}),'/200/website');
assert.deepEqual(parse('/200/attention'),{studioId:'200',view:'all-comments',filter:'attention'});
assert.deepEqual(parse('/200/attention?kind=feedback'),{studioId:'200',view:'all-comments',filter:'attention'});
assert.deepEqual(parse('/200/comments?filter=attention'),{studioId:'200',view:'all-comments',filter:'attention'});
assert.equal(parse('/200/comments?filter=invalid').filter,'all');
assert.equal(workspaceUrl({studioId:'200',view:'all-comments',communicationFilter:'attention'}),'/200/comments?filter=attention');
