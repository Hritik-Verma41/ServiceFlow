import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:serviceflow/main.dart';

void main() {
  testWidgets('ServiceFlow app starts successfully', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: ServiceFlowApp()));

    expect(find.byType(ServiceFlowApp), findsOneWidget);
  });
}
