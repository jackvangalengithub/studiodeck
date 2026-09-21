import {formatWithCursor} from 'prettier/standalone';
import html from 'prettier/plugins/html';
import postcss from 'prettier/plugins/postcss';
import babel from 'prettier/plugins/babel';
import estree from 'prettier/plugins/estree';

export function formatSource(filename,value,cursorOffset=0){
 const parser={html:'html',css:'css',js:'babel'}[filename.split('.').pop()];
 if(!parser)throw new Error('Choose an HTML, CSS or JavaScript website file.');
 return formatWithCursor(value,{parser,plugins:[html,postcss,babel,estree],cursorOffset,tabWidth:2,useTabs:false,printWidth:100,htmlWhitespaceSensitivity:'css',endOfLine:'lf'});
}
