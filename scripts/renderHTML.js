// @ts-check
'use strict';

// renderHTML.js
// 生成HTML文件

const fs = require("fs");
const path = require('path');
const moment = require('moment');


const dateString = moment().subtract(1, 'days').format('YYYY-MM-DD');

const XinwenLianbo = fs.readFileSync('./abstract-XinwenLianbo.txt', "utf8");
const guancha = fs.readFileSync('./abstract-guancha.txt', "utf8");
const PeopleDaily = fs.readFileSync('./abstract-PeopleDaily.txt', "utf8");


const htmlString = `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>中文新闻</title>
</head>

<body>
  <h1>${dateString}</h1>${XinwenLianbo}${PeopleDaily}${guancha}
</body>
</html>
`;

// html文件夹留档
fs.writeFileSync(`../html/${dateString}-中文媒体.html`, htmlString, "utf8");



// 项目文件夹中创建 index.html 作为首页
// 把同一日期的所有 .html 文件的文件名和路径记录下来，然后写入 index.html 作为首页
// 对读入的文件路径数组进行向量化操作
let liStringArray = fs.readdirSync(`../html/`)
  .filter(fileName => fileName.startsWith(dateString))
  .sort().reverse()
  .map(fileName => {
    const media = fileName.replace(dateString + '-', '').replace('.html', '');
    const filePath = path.join('.', 'html', fileName);
    return `<li><a href='${filePath}'>${media}</a></li>`;
  });
let ulString = `<ul>` + liStringArray.join('') + '</ul>';

const indexString = `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>每日新闻集萃</title>
  <style>
    li {
      font-size: 1em;
    }
  </style>
</head>

<body>

  <h1>昨日新闻集萃: ${dateString}</h1>${ulString}

  </body>
</html>
`;

fs.writeFileSync('../index.html', indexString, "utf8");