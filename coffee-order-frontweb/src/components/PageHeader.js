import React from 'react';
import './PageHeader.css';

const PageHeader = ({ title, description }) => (
  <div className="page-heading">
    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </div>
);

export default PageHeader;
