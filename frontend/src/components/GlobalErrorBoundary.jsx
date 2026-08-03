import { Component } from 'react';

class GlobalErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Beklenmeyen arayüz hatası:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: '640px', margin: '80px auto', padding: '24px' }}>
          <section className="custom-card">
            <h1>Sayfa görüntülenemedi</h1>
            <p>Beklenmeyen bir arayüz hatası oluştu. Oturumu koruyarak sayfayı yeniden deneyebilirsiniz.</p>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
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
