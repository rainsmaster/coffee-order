import React, { useLayoutEffect, useRef, useState } from 'react';
import './MenuThumbnail.css';

const getImageUrl = (menu) => {
  const remotePath = menu.menuImg02 || menu.menuImg;
  const imageUrl = menu.localImgPath || (remotePath ? `https://mcdn.twosome.co.kr${remotePath}` : '');
  if (!imageUrl || !menu.localImgPath || !remotePath) return imageUrl;

  const version = remotePath.split('/').pop();
  return `${imageUrl}?v=${encodeURIComponent(version)}`;
};

const loadedImageUrls = new Set();

const MenuThumbnail = ({ menu }) => {
  const imageUrl = getImageUrl(menu);
  const imageRef = useRef(null);
  const [loaded, setLoaded] = useState(() => loadedImageUrls.has(imageUrl));
  const [failed, setFailed] = useState(!imageUrl);

  useLayoutEffect(() => {
    setLoaded(loadedImageUrls.has(imageUrl));
    setFailed(!imageUrl);
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
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
          onLoad={() => {
            loadedImageUrls.add(imageUrl);
            setLoaded(true);
          }}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      )}
    </div>
  );
};

export default React.memo(MenuThumbnail);
