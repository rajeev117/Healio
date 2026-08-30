// Patient-raised test requests waiting to be priced.
// The screen is already parameterised by kind and shared with every other
// lab/pharmacy module — see src/components/OrderRequestsScreen.
import React from 'react';
import OrderRequestsScreen from '../../../components/OrderRequestsScreen';
import { COLORS } from '../constants/theme';

export default function OrderRequests(props) {
  return <OrderRequestsScreen {...props} kind="lab" colors={COLORS} />;
}
