// Pharmacy's queue of patient prescription orders waiting to be priced.
// The screen itself is shared with the lab module — see components.
import React from 'react';
import OrderRequestsScreen from '../../../components/OrderRequestsScreen';
import { COLORS } from '../constants/theme';

export default function OrderRequests(props) {
  return <OrderRequestsScreen {...props} kind="pharmacy" colors={COLORS} />;
}
