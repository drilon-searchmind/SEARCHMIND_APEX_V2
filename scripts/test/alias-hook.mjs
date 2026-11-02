import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} specifier
 * @param {import('node:module').ResolveHookContext} context
 * @param {import('node:module').ResolveHook} nextResolve
 */
function toFileUrl(relativePath) {
	let filePath = path.join(root, relativePath);
	if (!path.extname(filePath)) {
		filePath = `${filePath}.js`;
	}
	return pathToFileURL(filePath).href;
}

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith("@/")) {
		return nextResolve(toFileUrl(path.join("src", specifier.slice(2))), context);
	}
	if (specifier.startsWith("@root/")) {
		return nextResolve(toFileUrl(specifier.replace(/^@root\//, "")), context);
	}
	return nextResolve(specifier, context);
}
