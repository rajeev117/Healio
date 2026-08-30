import { useState, useEffect } from 'react';
import { ApiService } from '../services/ApiService';

export const useRecords = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getRecords();
      setRecords(data);
    } catch (error) {
      console.error('Records controller error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { loading, records, refresh: fetchData };
};
