pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    parameters {
        booleanParam(
            name: 'DEPLOY',
            defaultValue: false,
            description: '빌드 성공 후 운영 NAS에 배포합니다. 체크하지 않으면 테스트와 이미지 빌드만 수행합니다.'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()
                    env.APP_IMAGE = "coffee-order-svc:${env.IMAGE_TAG}"
                    env.OCR_IMAGE = "coffee-order-ocr:${env.IMAGE_TAG}"
                }
                echo "Build images: ${env.APP_IMAGE}, ${env.OCR_IMAGE}"
            }
        }

        stage('Test') {
            steps {
                sh './mvnw --batch-mode clean package'
            }
        }

        stage('Build app image') {
            steps {
                sh 'docker build --platform linux/amd64 --tag "$APP_IMAGE" .'
                sh 'test "$(docker image inspect --format "{{.Os}}/{{.Architecture}}" "$APP_IMAGE")" = "linux/amd64"'
            }
        }

        stage('Build OCR image') {
            steps {
                sh 'docker build --platform linux/amd64 --tag "$OCR_IMAGE" ./ocr-service'
                sh 'test "$(docker image inspect --format "{{.Os}}/{{.Architecture}}" "$OCR_IMAGE")" = "linux/amd64"'
            }
        }

        stage('Deploy') {
            when {
                expression { return params.DEPLOY }
            }
            steps {
                input message: "운영에 ${env.APP_IMAGE} 및 ${env.OCR_IMAGE}를 배포할까요?", ok: '배포 실행'
                withCredentials([
                    string(credentialsId: 'coffee-mysql-password', variable: 'MYSQL_PASSWORD'),
                    string(credentialsId: 'coffee-mysql-root-password', variable: 'MYSQL_ROOT_PASSWORD'),
                    usernamePassword(
                        credentialsId: 'coffee-twosome-admin',
                        usernameVariable: 'TWOSOME_ADMIN_ID',
                        passwordVariable: 'TWOSOME_ADMIN_PW'
                    ),
                    string(credentialsId: 'coffee-twosome-crypto-key', variable: 'TWOSOME_CRYPTO_KEY'),
                    string(credentialsId: 'coffee-admin-password', variable: 'ADMIN_PASSWORD')
                ]) {
                    sh './scripts/deploy-nas.sh'
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'coffee-order-api/target/surefire-reports/*.xml'
        }
        success {
            echo(params.DEPLOY ? 'Build and deployment completed.' : 'Build completed without deployment.')
        }
    }
}
