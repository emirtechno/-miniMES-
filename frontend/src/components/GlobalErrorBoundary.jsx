import { Component } from 'react';

class GlobalErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Beklenmeyen arayüz hatası:', error, info);
    // #region agent log
    fetch('http://127.0.0.1:7845/ingest/a8884a6c-891e-4596-b89a-d935c7793420',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'492148'},body:JSON.stringify({sessionId:'492148',runId:'crash-scan',hypothesisId:'H4',location:'GlobalErrorBoundary.jsx:componentDidCatch',message:'React error boundary caught',data:{name:error?.name,errMessage:String(error?.message||error),stack:String(error?.stack||'').slice(0,800),componentStack:String(info?.componentStack||'').slice(0,800)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: '640px', margin: '80px auto', padding: '24px' }}>
          <section className="custom-card">
            <h1>Sayfa görüntülenemedi</h1>
            <p>Beklenmeyen bir arayüz hatası oluştu. Oturumu koruyarak sayfayı yeniden deneyebilirsiniz.</p>
            <button type="button" className="mes-btn-primary" onClick={() => window.location.reload()}>
              Sayfayı Yenile
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
