// @ts-check
'use strict';

// renderHTML.js
// 生成HTML文件

const fs = require("fs");


const date = new Date();
date.setDate(date.getDate() - 1);
const year = date.getFullYear().toString();
const month = (date.getMonth() + 1).toString().padStart(2, '0');
const day = date.getDate().toString().padStart(2, '0');
const dateString = `${year}-${month}-${day}`;


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
  <title>每日新闻链接</title>
</head>

<body>
  <h1>${dateString}</h1>${XinwenLianbo}${guancha}${PeopleDaily}
</body>
</html>
`;


// html文件夹留档
fs.writeFileSync(`../html/${dateString}-中文媒体.html`, htmlString, "utf8");









// 项目文件夹中创建 index.html 作为首页
// 想办法把同一日期的所有 .html 文件的文件名和路径记录下来，然后化为一个列表写入 index.html 作为首页
// fs.writeFileSync('../index.html', indexString, "utf8");