import { useState, useEffect } from 'react';
import { ApiService } from '../services/ApiService';

export const useServices = (searchQuery = '') => {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getServices();
        setServices(data);
        setFilteredServices(data);
      } catch (error) {
        console.error('Services controller error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredServices(services);
    } else {
      const filtered = services.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.desc.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredServices(filtered);
    }
  }, [searchQuery, services]);

  return { loading, services: filteredServices };
};
