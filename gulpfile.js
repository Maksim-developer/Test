import { src, dest, watch, series, parallel } from 'gulp';
import sassCompiler from 'gulp-sass';
import * as sass from 'sass';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import cleanCSS from 'gulp-clean-css';
import rename from 'gulp-rename';
import fileinclude from 'gulp-file-include';
import browsersync from 'browser-sync';
import { deleteAsync } from 'del';
import plumber from 'gulp-plumber';
import sharp from 'sharp';
import through2 from 'through2';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import ttf2woff2 from 'gulp-ttf2woff2';
import terser from 'gulp-terser';
import concat from 'gulp-concat';
import gulpIf from 'gulp-if';

const project_folder = "dist";
const source_folder = "./#src";

const path = {
    build: {
        html: project_folder + "/",
        css: project_folder + "/css/",
        js: project_folder + "/js/",
        img: project_folder + "/img/",
        video: project_folder + "/video/",
        fonts: project_folder + "/fonts/",
    },
    src: {
        html: [source_folder + "/*.html", "!" + source_folder + "/_*.html"],
        css: source_folder + "/css/*.css",
        scss: source_folder + "/scss/app.scss",
        js: [source_folder + "/js/**/*.js"],
        img: source_folder + "/img/**/*.{jpg,jpeg,png,svg,gif,ico,webp,avif}",
        video: source_folder + "/video/**/*",
        fonts: source_folder + "/fonts/**/*",
    },
    watch: {
        html: source_folder + "/**/*.html",
        css: source_folder + "/css/**/*.css",
        scss: source_folder + "/scss/**/*.scss",
        js: [source_folder + "/js/**/*.js"],
        img: source_folder + "/img/**/*.{jpg,jpeg,png,svg,gif,ico,webp,avif}",
        video: source_folder + "/video/**/*",
        fonts: source_folder + "/fonts/**/*",
    },
    clean: "./" + project_folder + "/"
};

const browserSync = () => {
    browsersync.init({
        server: { baseDir: "./" + project_folder + "/" },
        port: 3000,
        notify: false,
    });
};

const convertRasterImgToPicture = (html) => {
    const imgTagRegex = /<img\b[^>]*\bsrc=(["'])([^"']+\.(?:png|jpe?g))\1[^>]*>/gi;

    return html.replace(imgTagRegex, (imgTag) => {
        if (/data-no-picture/i.test(imgTag)) return imgTag;
        if (/<picture/i.test(imgTag)) return imgTag;

        const srcMatch = imgTag.match(/\bsrc=(["'])([^"']+)\1/i);
        if (!srcMatch) return imgTag;

        const originalSrc = srcMatch[2];
        if (/^(https?:)?\/\//i.test(originalSrc) || /^data:/i.test(originalSrc)) return imgTag;

        const avifSrc = originalSrc.replace(/\.(png|jpe?g)$/i, ".avif");
        const webpSrc = originalSrc.replace(/\.(png|jpe?g)$/i, ".webp");

        return `<picture><source srcset="${avifSrc}" type="image/avif"><source srcset="${webpSrc}" type="image/webp">${imgTag}</picture>`;
    });
};

const addLazyLoadingToImages = (html) => {
    const imgTagRegex = /<img\b[^>]*>/gi;

    return html.replace(imgTagRegex, (imgTag) => {
        if (/data-no-lazy/i.test(imgTag)) return imgTag;
        if (/\bloading\s*=\s*["'][^"']+["']/i.test(imgTag) || /\bloading\s*=\s*[^\s>]+/i.test(imgTag)) return imgTag;

        const withLazy = imgTag.replace(/<img\b/i, '<img loading="lazy" decoding="async"');
        return withLazy;
    });
};

const collectFilesRecursive = (directoryPath, extensionRegex) => {
    if (!existsSync(directoryPath)) return [];

    const entries = readdirSync(directoryPath, { withFileTypes: true });
    let files = [];

    for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(collectFilesRecursive(fullPath, extensionRegex));
            continue;
        }
        if (extensionRegex.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
};

const getAssetsVersion = () => {
    const cssFiles = collectFilesRecursive(path.build.css, /\.css$/i);
    const jsFiles = collectFilesRecursive(path.build.js, /\.js$/i);
    const files = [...cssFiles, ...jsFiles].sort();

    if (!files.length) {
        return Date.now().toString();
    }

    const hash = createHash("md5");
    for (const filePath of files) {
        const stat = statSync(filePath);
        hash.update(`${filePath}:${stat.size}:${stat.mtimeMs};`);
    }

    return hash.digest("hex").slice(0, 10);
};

const addCacheBustingToCssAndJs = (html, buildVersion) => {
    const appendVersion = (url) => {
        if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) return url;
        if (!/^(css|js)\//i.test(url)) return url;

        const hasQuery = url.includes("?");
        const withoutOldVersion = url.replace(/([?&])v=[^&]*(&)?/i, (match, p1, p2) => (p1 === "?" && p2 ? "?" : p2 ? p1 : ""));
        const hasQueryAfterCleanup = withoutOldVersion.includes("?");
        return `${withoutOldVersion}${hasQueryAfterCleanup ? "&" : "?"}v=${buildVersion}`;
    };

    const linkRegex = /(<link\b[^>]*\bhref=(["']))([^"']+)(\2[^>]*>)/gi;
    const scriptRegex = /(<script\b[^>]*\bsrc=(["']))([^"']+)(\2[^>]*>)/gi;

    const htmlWithVersionedLinks = html.replace(linkRegex, (_, before, quote, href, after) => {
        return `${before}${appendVersion(href)}${after}`;
    });

    return htmlWithVersionedLinks.replace(scriptRegex, (_, before, quote, src, after) => {
        return `${before}${appendVersion(src)}${after}`;
    });
};

const html = () => {
    return src(path.src.html, { allowEmpty: true })
        .pipe(fileinclude())
        .pipe(through2.obj((file, _, callback) => {
            if (file.isNull()) return callback(null, file);
            if (file.isStream()) return callback(new Error('Streaming is not supported for HTML processing'));

            const htmlContent = file.contents.toString();
            const htmlWithPicture = convertRasterImgToPicture(htmlContent);
            const htmlWithLazy = addLazyLoadingToImages(htmlWithPicture);
            const buildVersion = getAssetsVersion();
            file.contents = Buffer.from(addCacheBustingToCssAndJs(htmlWithLazy, buildVersion));
            callback(null, file);
        }))
        .pipe(dest(path.build.html))
        .pipe(browsersync.stream());
};

const scss = () => {
    const sassPipe = sassCompiler(sass);
    return src(path.src.scss, { allowEmpty: true })
        .pipe(plumber({
            errorHandler(err) {
                console.error('--- Ошибка в SCSS ---');
                console.error(err.messageFormatted);
                this.emit('end');
            }
        }))
        .pipe(sassPipe({ outputStyle: "expanded" }))
        .on('error', sassPipe.logError)
        .pipe(postcss([autoprefixer({ overrideBrowserslist: ["last 5 versions"], cascade: true })]))
        .pipe(dest(path.build.css))
        .pipe(cleanCSS())
        .pipe(rename({ suffix: ".min", extname: ".css" }))
        .pipe(dest(path.build.css))
        .pipe(browsersync.stream());
};

const css = () => {
    return src(path.src.css, { allowEmpty: true })
        .pipe(dest(path.build.css))
        .pipe(browsersync.stream());
};

const js = () => {
    return src(path.src.js, { allowEmpty: true })
        .pipe(fileinclude())
        .pipe(dest(path.build.js))
        .pipe(
            gulpIf(
                (file) => file.basename !== 'app.js',
                terser()
            )
        )
        .on('error', (err) => {
            console.error('Ошибка при минификации JS:', err.toString());
            this.emit('end');
        })
        .pipe(dest(path.build.js))
        .pipe(browsersync.stream());
};

const imagesOptimize = () => {
    return src(path.src.img, { allowEmpty: true, encoding: false })
        .pipe(through2.obj((file, _, callback) => {
            if (file.isNull()) return callback(null, file);
            if (file.isStream()) return callback(new Error('Streaming is not supported for image optimization'));

            const extension = extname(file.path).toLowerCase();
            const isJpeg = extension === ".jpg" || extension === ".jpeg";
            const isPng = extension === ".png";

            if (!isJpeg && !isPng) return callback(null, file);

            const sharpInstance = sharp(file.contents);
            const optimizePromise = isJpeg
                ? sharpInstance.jpeg({ quality: 80, progressive: true })
                : sharpInstance.png({ quality: 80, compressionLevel: 9, palette: true });

            optimizePromise
                .toBuffer()
                .then((outputBuffer) => {
                    file.contents = outputBuffer;
                    callback(null, file);
                })
                .catch((error) => callback(error));
        }))
        .pipe(dest(path.build.img))
        .pipe(browsersync.stream())
};

const imagesWebp = () => {
    return src(source_folder + "/img/**/*.{jpg,jpeg,png}", { allowEmpty: true, encoding: false })
        .pipe(through2.obj((file, _, callback) => {
            if (file.isNull()) return callback(null, file);
            if (file.isStream()) return callback(new Error('Streaming is not supported for WEBP conversion'));

            sharp(file.contents)
                .webp({ quality: 80 })
                .toBuffer()
                .then((outputBuffer) => {
                    file.contents = outputBuffer;
                    file.path = file.path.replace(/\.(jpe?g|png)$/i, ".webp");
                    callback(null, file);
                })
                .catch((error) => callback(error));
        }))
        .pipe(dest(path.build.img))
        .pipe(browsersync.stream())
};

const imagesAvif = () => {
    return src(source_folder + "/img/**/*.{jpg,jpeg,png}", { allowEmpty: true, encoding: false })
        .pipe(through2.obj((file, _, callback) => {
            if (file.isNull()) return callback(null, file);
            if (file.isStream()) return callback(new Error('Streaming is not supported for AVIF conversion'));

            sharp(file.contents)
                .avif({ quality: 50 })
                .toBuffer()
                .then((outputBuffer) => {
                    file.contents = outputBuffer;
                    file.path = file.path.replace(/\.(jpe?g|png)$/i, ".avif");
                    callback(null, file);
                })
                .catch((error) => callback(error));
        }))
        .pipe(dest(path.build.img))
        .pipe(browsersync.stream())
};

const images = series(imagesOptimize, imagesWebp, imagesAvif);


const copyFonts = () => {
    return src(source_folder + "/fonts/**/*", { allowEmpty: true, encoding: false })
        .pipe(dest(path.build.fonts));
};


const fonts = series(copyFonts);


const cleanBuild = () => deleteAsync(path.clean);


const watchFiles = () => {
    watch([path.watch.html], html);
    watch([path.watch.scss], series(scss, html));
    watch([path.watch.css], css);
    watch([path.watch.js], series(js, html));
    watch([path.watch.img], images);
    // watch([path.watch.video], video);
    watch([path.watch.fonts], fonts);
};


export const build = series(
    cleanBuild,
    parallel(js, scss, css, images, fonts),
    html
);


export const watchTask = parallel(build, watchFiles, browserSync);


export default watchTask;