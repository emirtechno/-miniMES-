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
        <main className="mx-auto max-w-xl p-6">
          <section className="mes-surface p-5">
            <h1 className="mes-section-title">Sayfa görüntülenemedi</h1>
            <p className="mes-helper">Beklenmeyen bir arayüz hatası oluştu. Oturumu koruyarak sayfayı yeniden deneyebilirsiniz.</p>
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
