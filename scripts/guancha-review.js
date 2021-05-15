// @ts-check
'use strict';

// guancha-review.js
// 爬取观察者网的时评

const fs = require("fs");
const puppeteer = require('puppeteer');
const { MongoClient } = require("mongodb");


// config
const websiteURL = 'https://www.guancha.cn';
const timeSpan = 1; //共抓取的天数
main();


async function main() {
  // 1. 爬取昨天到截止日期的所有评论文章
  const dateRange = getDateRange(timeSpan);
  const dateFloor = dateRange[dateRange.length - 1]; // 爬取不应涉及的停止日期，如timeSpan=1，则dateFloor就是前天，dateFloor及其之前的条目都不会爬取
  const reviews = await crawlReview(dateFloor); // 从第一页开始爬，直到条目中包含截止日期 dateFloor 就停下

  // 2. 从整数页条目中筛选需要的日期，此处没有用数据结构优化，暴力筛选，省脑
  dateRange.pop(); // 去掉截止日期，仅剩当初打算爬取的日期
  const reviewToAdd = reviews.filter(article => {
    return dateRange.some(date => article.releaseTime.startsWith(date));
  });

  // 3. 保存
  saveData(reviewToAdd);
  saveAbstract(reviewToAdd);
}


/**
 * 该函数返回一个倒序排列的日期数组
 * 第一项为程序运行的前一天，最后一项为爬虫的停止日期。
 * 数组长度比timeSpan多1。比如timeSpan=1，则返回昨天和前天
 * @param timeSpan 从昨天开始倒序推算，打算爬取多少天的条目
 */
function getDateRange(timeSpan) {
  const date = new Date();
  const dateRange = [];
  for (let i = 0; i <= timeSpan; i++) { // 数组的最后一项是爬取函数停止日期
    date.setDate(date.getDate() - 1); // 程序一般从新一天的凌晨开始跑，因此爬取从前一天发布的新闻开始
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    dateRange.push(`${year}-${month}-${day}`);
  }
  return dateRange;
}


/**
 * 返回若干整数页的条目。从第一页开始爬，直到条目中包含截止日期停下
 * @param dateFloor 循环的截止日期
 */
async function crawlReview(dateFloor) {
  console.log(`Crawling... would not stop until ` + dateFloor);

  // 启动 headless 浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1920, height: 1080, isMobile: false, },
  });
  let pages = await browser.pages();
  let currentPage = pages[0];

  // 依次爬取页面，直到满足停止条件
  let pageIndex = 1;
  let articles = []; // 条目容器
  let shouldContinue = true;
  let url = '';

  do {
    console.log('Crawling Page: ' + pageIndex);
    url = websiteURL + `/mainnews-sp/list_${pageIndex}.shtml`; // 观察者网评论版的 url
    await currentPage.goto(url);


    // 爬取一页评论文章的信息
    const pageArticles = await currentPage.evaluate(siteURL => {
      const nodes = document.querySelectorAll('ul.review-list>li'); // 所有评论条目

      let items = []; // 容器
      nodes.forEach(async node => {
        const title = node.querySelector('h4>a').innerHTML;
        const link = siteURL + node.querySelector('h4>a').getAttribute('href').replace('.shtml', '_s.shtml'); // 详情页尾的“余下全文按钮”，可以省却翻页，在一页内显示全文
        const abstract = node.querySelector('p.module-artile').innerHTML;
        const authors = [];
        node.querySelectorAll('ul.fix>li').forEach(authorNode => {
          const authorName = authorNode.querySelector('div>p>a').innerHTML;
          const authorTitle = authorNode.querySelector('div>p>span').innerHTML;
          authors.push({ authorName: authorName, authorTitle: authorTitle, });
        });
        const attention = node.querySelector('div.module-interact>a.interact-attention').innerHTML;
        const releaseTime = node.querySelector('div.module-interact>span').innerHTML;

        items.push({
          sensationalTitle: title,
          link: link,
          abstract: abstract,
          author: authors,
          attention: attention,
          releaseTime: releaseTime,
        });
      });
      return items;

    }, websiteURL); //传入参数


    //若该页某一条目的日期为截止日期，则将继续循环条件设为 false
    if (pageArticles.some(article => article.releaseTime.startsWith(dateFloor))) {
      shouldContinue = false;
    }


    // 进入细节页爬取全文
    const subPage = await browser.newPage();
    for (let review of pageArticles) {
      console.log('Crawling full text:  ' + review.releaseTime + ' ' + review.sensationalTitle);
      await subPage.goto(review.link);

      // 正常（非标题党）标题和全文
      review.dispassionateTitle = (await subPage.$eval('li.left-main>h3', node => node.innerHTML)).split('：')[1];
      review.content = (await subPage.$$eval('div.all-txt>p', nodes => nodes.map(node => node.innerHTML.replace('\n', '')))).join('');

      // 对象成员重排序，并保存到容器
      const order = ['releaseTime', "sensationalTitle", "dispassionateTitle", "author", "abstract", "link", "attention", "content"];
      const reorderedObject = {};
      for (let member of order) {
        reorderedObject[member] = review[member];
      }
      articles.push(reorderedObject);

      await subPage.waitForTimeout(10); // 全文页爬取间隔
    }
    await subPage.close();
    pageIndex += 1;
  } while (shouldContinue);

  await browser.close();
  return articles;
}


/**
 * 将抓取到的对象数组保存到json和数据库
 * 千万注意相对路径，./ 还是 ../
 * @param items: 评论对象数组
 */
async function saveData(items) {
  save2JSON(items); // 更新JSON文件
  save2MongoDB(items); // 插入 MongoDB
  // items的数据结构，其中有对象的多重嵌套，不适合存放在 SQL 数据库中
}
async function save2JSON(items) {
  const savedItems = JSON.parse(fs.readFileSync('../json/guancha-review.json', "utf8"));
  const itemsUpdated = savedItems.concat(items);
  fs.writeFileSync('../json/guancha-review.json', JSON.stringify(itemsUpdated, null, "  "), "utf8");
  console.log('Data in json updated.');
}
async function save2MongoDB(items) {

  console.log('Inserting to MongoDB...');

  // 连接MongoDB服务
  const client = new MongoClient('mongodb://localhost:27017/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect()
    .then(
      // () => console.log('Connected successfully to MongoDB server.')
    )
    .catch(err => {
      console.error(err);
    });


  // 连接数据库
  const newsCrawling = client.db("newsCrawling");
  // 连接 collection
  const guanchaReview = newsCrawling.collection("guanchaReview");
  // 添加 documents
  const insertResult = await guanchaReview.insertMany(items);
  console.log(`${insertResult.insertedCount} items inserted.`);
  // 查询 documents
  // const findOptions = { projection: { _id: 0 }, };
  // const cursor = guanchaReview.find({}, findOptions).limit(10);
  // await cursor.forEach(document => console.log(document));
  // 删除 documents
  // const deleteResult = await guanchaReview.deleteMany({});
  // console.log("Deleted " + deleteResult.deletedCount + " documents");


  // 关闭与服务器的连接
  await client.close();
}


function saveAbstract(recentItems) {
  const abstracts = recentItems.map(item => {
    const link = item.link;
    const title = item.dispassionateTitle;
    const abstract = item.abstract;
    return `<li><span>【</span><a href="${link}">${title}</a><span>】${abstract}</span></li>`;
  }).join('');

  const htmlText = '<h2>观察者网时评</h2><ul>' + abstracts + '</ul>';

  fs.writeFileSync('./abstract-guancha.txt', htmlText, "utf8");
  console.log('Abstracts of guancha-review saved.');
}