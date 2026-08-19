import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SubjectId } from "../engine/types";

export type RootStackParamList = {
  SubjectPicker: undefined;
  Diagnostic: { subjectId: SubjectId };
  Review: { subjectId: SubjectId; focusNodeIds?: string[] };
  GapDashboard: { subjectId: SubjectId };
  ProblemPractice: { subjectId: SubjectId };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
