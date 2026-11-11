import React, { useLayoutEffect, useRef, useState } from 'react';
import './MenuThumbnail.css';

const getImageUrls = (menu) => {
  const remotePath = menu.menuImg02 || menu.menuImg;
  const remoteUrl = remotePath
    ? `https://mcdn.twosome.co.kr${remotePath}`.replace(/([?&]q=)100\b/, (match, prefix) => `${prefix}80`)
    : '';
  if (!menu.localImgPath) return remoteUrl ? [remoteUrl] : [];

  const withVersion = (path) => {
    if (!remotePath) return path;
    const version = remotePath.split('/').pop();
    return `${path}?imageVersion=${encodeURIComponent(version)}`;
  };
  const webpPath = menu.localImgPath.toLowerCase().endsWith('.webp')
    ? menu.localImgPath
    : `${menu.localImgPath}.webp`;
  return [...new Set([withVersion(webpPath), withVersion(menu.localImgPath)])];
};

const loadedImageUrls = new Set();

const MenuThumbnail = ({ menu }) => {
  const imageUrls = getImageUrls(menu);
  const imageRef = useRef(null);
  const [failedImageUrls, setFailedImageUrls] = useState(() => new Set());
  const imageUrl = imageUrls.find((url) => !failedImageUrls.has(url)) || '';
  const failed = !imageUrl;
  const [loaded, setLoaded] = useState(() => loadedImageUrls.has(imageUrl));

  useLayoutEffect(() => {
    setLoaded(loadedImageUrls.has(imageUrl));
    if (imageUrl && imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      loadedImageUrls.add(imageUrl);
      setLoaded(true);
    }
  }, [imageUrl]);

  return (
    <div className={`menu-thumbnail ${loaded ? 'is-loaded' : ''}`} aria-busy={!loaded && !failed}>
      {!loaded && !failed && <span className="menu-thumbnail-skeleton" aria-hidden="true" />}
      {failed ? (
        <span className="menu-thumbnail-fallback" role="img" aria-label={`${menu.menuNm} 이미지 없음`}>
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M10 14h25v12c0 8-4.9 13-12.5 13S10 34 10 26V14Z" stroke="currentColor" strokeWidth="2.5" />
            <path d="M35 17h3a5 5 0 0 1 0 10h-3M16 7v3m7-4v4m7-3v3M14 43h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <img
          ref={imageRef}
          className="menu-thumbnail-image"
          src={imageUrl}
          alt={menu.menuNm}
          width="276"
          height="276"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          sizes="(max-width: 480px) 30vw, 100px"
          onLoad={() => {
            loadedImageUrls.add(imageUrl);
            setLoaded(true);
          }}
          onError={() => {
            setLoaded(false);
            setFailedImageUrls((current) => new Set(current).add(imageUrl));
          }}
        />
      )}
    </div>
  );
};

export default React.memo(MenuThumbnail);
