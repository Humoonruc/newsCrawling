pipeline {
  agent any
  stages {
    stage('检出') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: env.GIT_BUILD_REF]], 
          userRemoteConfigs: [[url: env.GIT_REPO_URL, credentialsId: env.CREDENTIALS_ID]]
        ])
      }
    }
    stage('部署到腾讯云存储') {
      steps {
        sh "coscmd config -a AKIDEG2YnlSs1tUpse9OM3TcV7TYhZATWJp3 -s zi9JCo9D1ZqqZ1D7k7E4dvyjDQN3SaS4 -b news-crawling-1305177755 -r ap-hongkong"
        sh 'rm -rf .git'
        sh 'coscmd upload -r ./ /'
      }
    }
  }
}
