import React from "react";

interface FooterProps {
  detail?: string;
}

export function Footer({ detail = "Listener 0.0.0.0:5000 | PostgreSQL finvault_b20" }: FooterProps) {
  return (
    <footer className="app-footer">
      <div className="container app-footer__inner">
        <span>FinVault Portal (Topic B20)</span>
        {detail && <span className="measured">{detail}</span>}
      </div>
    </footer>
  );
}
