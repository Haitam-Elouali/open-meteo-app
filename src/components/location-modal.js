'use strict';

class LocationModal {
  constructor() {
    this.backdrop = null;
    this.modal = null;
    this.countrySelect = null;
    this.citySelect = null;
    this.cities = [];
    
    this.init();
  }
  
  init() {
    this.backdrop = document.querySelector('.location-modal-backdrop');
    this.modal = document.querySelector('.location-modal');
    this.countrySelect = document.querySelector('.location-country');
    this.citySelect = document.querySelector('.location-city');
    
    if (!this.backdrop || !this.modal) return;
    
    this.bindEvents();
    this.loadCountries();
  }
  
  bindEvents() {
    this.modal.querySelector('.location-cancel')?.addEventListener('click', () => this.close());
    this.modal.querySelector('.location-confirm')?.addEventListener('click', () => this.confirm());
    this.countrySelect?.addEventListener('change', (e) => this.onCountryChange(e));
    this.citySelect?.addEventListener('change', (e) => this.onCityChange(e));
  }
  
  async loadCountries() {
    try {
      const response = await fetch('/api/countries');
      const data = await response.json();
      
      if (data.countries) {
        data.countries.forEach(country => {
          const option = document.createElement('option');
          option.value = country;
          option.textContent = country;
          this.countrySelect.appendChild(option);
        });
      }
    } catch (e) {
      console.error('Failed to load countries:', e);
    }
  }
  
  async onCountryChange(e) {
    const country = e.target.value;
    this.citySelect.disabled = true;
    this.citySelect.innerHTML = '<option value="">Loading cities...</option>';
    
    if (!country) {
      this.citySelect.innerHTML = '<option value="">Select a country first</option>';
      return;
    }
    
    try {
      const response = await fetch(`/api/cities?country=${encodeURIComponent(country)}`);
      const data = await response.json();
      
      this.cities = data.cities || [];
      this.citySelect.innerHTML = '<option value="">Select a city</option>';
      
      this.cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        this.citySelect.appendChild(option);
      });
      
      this.citySelect.disabled = false;
    } catch (e) {
      console.error('Failed to load cities:', e);
      this.citySelect.innerHTML = '<option value="">Error loading cities</option>';
    }
  }
  
  onCityChange(e) {
    return;
  }
  
  open() {
    this.backdrop.hidden = false;
    this.countrySelect.value = '';
    this.citySelect.value = '';
    this.citySelect.disabled = true;
    document.body.style.overflow = 'hidden';
  }
  
  close() {
    this.backdrop.hidden = true;
    document.body.style.overflow = '';
  }
  
  async confirm() {
    const country = this.countrySelect.value;
    const city = this.citySelect.value;
    
    if (!country || !city) {
      alert('Please select both country and city');
      return;
    }
    
    try {
      const response = await fetch(`/api/location?country=${encodeURIComponent(country)}&name=${encodeURIComponent(city)}`);
      const data = await response.json();
      
      if (data.lat && data.lon) {
        this.close();
        
        const event = new CustomEvent('location-selected', {
          detail: {
            city: city,
            country: country,
            lat: data.lat,
            lon: data.lon
          }
        });
        document.dispatchEvent(event);
      }
    } catch (e) {
      console.error('Location fetch failed:', e);
      alert('Failed to get location data');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.locationModal = new LocationModal();

  // The header geolocation button opens the picker on every page (it was
  // present in the markup everywhere but never wired up).
  const geoButton = document.querySelector('.header__geo-button');
  if (geoButton) {
    geoButton.addEventListener('click', () => {
      if (window.locationModal) window.locationModal.open();
    });
  }
});