# 新闻爬虫

## 各媒体特点

The New York Times, BBC 和 RT(Russia Today) 都是综合性媒体，订阅邮件的主要内容是一天的热点，领域广而内容浅。RT 的评论区是一大特色，很多意见是西方主流媒体上看不到的。

FT中文网和 Foreign Affairs 内容就深一些，主要关注的也是政经新闻。 





## 技术支持

### 版本管理

#### 多平台同步

该项目分别保存在个人电脑中和个人服务器上，此外还托管在 CODING、GitHub 和 Gitee 上（Gitee 上的对应仓库由 CODING 导入）。

以香港服务器运行的 CODING 为主平台，GitHub 和 Gitee 为备份平台。GitHub 的缺点在于国内访问的网络不稳定，Gitee 则面临比较严格的审查，数据文件可能被删除。

通过 Git 的同步操作，个人电脑、个人服务器和 CODING 上的版本很容易保持一致，然后有空了可以在 Gitee 上手动强制同步，以及手动 git push 到 GitHub.

生成的 index.html 托管在 GitHub Pages 和 腾讯云上。GitHub Pages 有根据提交自动构建的功能，腾讯云理论上也有，但不知为何不能正常工作，只能用定时构建实现不那么及时的自动化。

#### 精简同步

利用 .gitignore 文件，对 puppeteer 这个 headless browser 不同步，SQlite 数据库为二进制文件，也不同步，否则 .git/ 文件夹会膨胀得非常恐怖。

#### GUI 操作

VSCode 集成了 Git 功能，可以以鼠标点击的方式 Push 和 Pull 新版本。

### 数据保存

#### 冗余备份

1. ./json/ 文件夹中的 JSON 数据文件
2. ./database/ 文件夹中的 sqlite3 数据库文件
3. 本地和服务器上的 MongoDB 数据库（服务器上的数据库相对不安全，又被黑客入侵的危险）

### 定时运行

利用服务器永不关机的优势，定时运行爬虫脚本。

计划任务中，bash内的各行命令是堵塞式同步执行的，因此是彻底运行完一个脚本才会运行另一个脚本。

运行完所有脚本后，使用 SSH 方式（不必输入账号和密码）执行推送到 CODING 的命令。

