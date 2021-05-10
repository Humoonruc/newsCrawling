// @ts-check
'use strict';
// guancha-review.js
// 爬取观察者网的时评

const fs = require("fs");
const puppeteer = require('puppeteer');


/**
 * 返回若干整数页的条目。从第一页开始爬，直到条目中包含截止日期
 * @param dateFloor 爬取截止日期
 */
async function crawlReview(dateFloor) {
  console.log(`Crawling... would not stop until ` + dateFloor);

  // 启动 headless 浏览器
  const browser = await puppeteer.launch({
    headless: true,
    slowMo: 1,
    defaultViewport: { width: 1366, height: 768, isMobile: false, },
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
      const nodes = document.querySelectorAll('ul.review-list>li');

      let items = [];
      nodes.forEach(async node => {

        const title = node.querySelector('h4>a').innerHTML;
        const link = siteURL + node.querySelector('h4>a').getAttribute('href').replace('.shtml', '_s.shtml'); //末尾的转换可以省却翻页，在一页内显示全文
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


    //若该页某一条目的日期为截止日期，将将爬取条件设为 false
    if (pageArticles.some(article => article.releaseTime.startsWith(dateFloor))) {
      shouldContinue = false;
    }


    // 爬取全文
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

      await subPage.waitForTimeout(10); // 两次爬取间隔
    }
    await subPage.close();
    pageIndex += 1;
    await currentPage.waitForTimeout(10); // 两次爬取间隔
  } while (shouldContinue);

  await browser.close();
  return articles;
}


/**
 * 爬取条目的日期范围，从最后日期到截止日期（比爬取的最早日期更早一天）
 * @param timeSpan 从昨天向前，爬取多少天的条目
 */
function getDateRange(timeSpan) {
  let dateRange = [];
  const date = new Date();
  for (let i = 0; i <= timeSpan; i++) { // 数组的最后一项是爬取函数停止日期
    date.setDate(date.getDate() - 1); // 程序一般从新一天的凌晨开始跑，因此爬取从前一天发布的新闻开始
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    dateRange.push(`${year}-${month}-${day}`);
  }
  return dateRange;
}



async function main() {

  // 1. 爬取昨天到截止日期的所有评论文章
  const dateRange = getDateRange(timeSpan);
  const dateFloor = dateRange[dateRange.length - 1]; // 爬取停止日期
  const reviewArticles = await crawlReview(dateFloor);

  // 2. 从整数页条目中筛选需要的日期
  // 此处没有用数据结构优化，暴力筛选，省脑
  dateRange.pop();
  const reviewsToAdd = reviewArticles.filter(article => {
    return dateRange.some(date => article.releaseTime.startsWith(date));
  });
  fs.writeFileSync('./data/guancha-review.json', JSON.stringify(reviewsToAdd), "utf8");
}



// config
const websiteURL = 'https://www.guancha.cn';
const timeSpan = 1; //共抓取的天数
main();