// Lab's queue of patient test requests waiting to be priced.
// The screen itself is shared with the pharmacy module — see components.
import React from 'react';
import OrderRequestsScreen from '../../../components/OrderRequestsScreen';
import { COLORS } from '../constants/theme';

export default function OrderRequests(props) {
  return <OrderRequestsScreen {...props} kind="lab" colors={COLORS} />;
}
