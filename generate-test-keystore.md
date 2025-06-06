# 生成测试Keystore并设置GitHub Secrets

## 第一步：生成测试Keystore

在本地运行以下命令生成一个测试用的keystore：

```bash
keytool -genkey -v -keystore test-keystore.jks -alias testkey -keyalg RSA -keysize 2048 -validity 10000 -storepass testpassword -keypass testpassword -dname "CN=Test, OU=Test, O=Test, L=Test, S=Test, C=US"
```

这将创建一个名为 `test-keystore.jks` 的文件，密码为 `testpassword`。

## 第二步：转换Keystore为Base64

将keystore文件转换为base64格式：

**在Linux/Mac上：**
```bash
base64 -i test-keystore.jks
```

**在Windows上（PowerShell）：**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("test-keystore.jks"))
```

## 第三步：设置GitHub Secrets

在GitHub仓库中设置以下Secrets：

1. 进入 GitHub仓库 → Settings → Secrets and variables → Actions
2. 添加以下secrets：

- `ANDROID_KEYSTORE_BASE64`: 上一步生成的base64字符串
- `KEYSTORE_PASSWORD`: `testpassword`
- `KEY_ALIAS`: `testkey` 
- `KEY_PASSWORD`: `testpassword`

## 测试说明

1. **没有ProGuard的版本** - 使用 `main-no-proguard.yml` workflow
   - 这个版本完全禁用了代码混淆和优化
   - 如果这个版本不闪退，说明问题确实出在ProGuard配置上

2. **有ProGuard的版本** - 使用 `main.yml` workflow  
   - 这个版本使用了保守的ProGuard配置
   - 如果还是闪退，我们需要进一步调整ProGuard规则

## 下一步诊断

如果禁用ProGuard后仍然闪退，可能的原因：
1. 签名问题
2. Native库兼容性问题
3. 资源文件缺失
4. 权限配置问题
5. 其他代码问题

## 快速测试命令

你可以直接使用这些预设值进行测试：

```
ANDROID_KEYSTORE_BASE64: [上面生成的base64字符串]
KEYSTORE_PASSWORD: testpassword
KEY_ALIAS: testkey
KEY_PASSWORD: testpassword
``` 