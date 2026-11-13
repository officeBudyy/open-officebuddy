/**
 * Electron `app.getName()` 的唯一事实源。
 *
 * safeStorage 的主密钥按 app 名字定位（macOS 钥匙串条目 `<name> Safe Storage`），
 * 名字不同即是两把互不通用的密钥：同一份密文只能被写入它的那一侧解开。
 * 因此主进程会在开发态与打包态都无条件覆盖 `app.name`。打包元数据可以使用公开品牌名，
 * safeStorage 仍始终使用这个兼容名称，否则存量用户已保存的 API key 将无法解密。
 * 覆盖行为由 `app-identity.test.ts` 机械校验。
 *
 * 修改此常量会让所有存量用户已保存的凭据无法解密，必须同时提供迁移方案。
 */
export const APP_RUNTIME_NAME = "astravia";

/** Windows shell / toast identity. This may use the public brand without changing safeStorage's runtime name. */
export const APP_USER_MODEL_ID = "com.officebuddy.desktop";
