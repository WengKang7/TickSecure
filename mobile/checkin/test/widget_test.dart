import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticksecure_checkin/main.dart';

void main() {
  testWidgets('staff login opens without activating a camera', (tester) async {
    await tester.pumpWidget(const CheckinApp());
    expect(find.text('Staff sign in'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    expect(find.text('Scan ticket QR'), findsNothing);
  });
}
