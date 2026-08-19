import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SubjectPickerScreen } from "./src/screens/SubjectPickerScreen";
import { DiagnosticScreen } from "./src/screens/DiagnosticScreen";
import { GapDashboardScreen } from "./src/screens/GapDashboardScreen";
import { ReviewScreen } from "./src/screens/ReviewScreen";
import { ProblemPracticeScreen } from "./src/screens/ProblemPracticeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RootStackParamList } from "./src/navigation/types";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.primary,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="SubjectPicker"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="SubjectPicker" component={SubjectPickerScreen} />
        <Stack.Screen name="Diagnostic" component={DiagnosticScreen} />
        <Stack.Screen name="GapDashboard" component={GapDashboardScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        <Stack.Screen name="ProblemPractice" component={ProblemPracticeScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
