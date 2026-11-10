import { DESKTOP_PRODUCT_NAME } from "./desktop-packaging-layout.mjs";

export const WINDOWS_RELEASE_TARGETS = Object.freeze(["inno", "msi", "zip"]);

export const WINDOWS_SUPPLEMENTAL_EXTENSIONS = Object.freeze([".msi", ".zip"]);

export function windowsSupplementalArtifactNames(version) {
	return WINDOWS_SUPPLEMENTAL_EXTENSIONS.map((extension) => `${DESKTOP_PRODUCT_NAME}-${version}-win-x64${extension}`);
}
