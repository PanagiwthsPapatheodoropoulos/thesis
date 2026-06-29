package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.TaskCommentCreateDTO;
import com.thesis.smart_resource_planner.model.dto.TaskCommentDTO;
import com.thesis.smart_resource_planner.model.entity.Task;
import com.thesis.smart_resource_planner.model.entity.TaskComment;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.TaskCommentRepository;
import com.thesis.smart_resource_planner.repository.TaskRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskCommentServiceDedicatedTest {

    @Mock private TaskCommentRepository commentRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private UserRepository userRepository;
    @Mock private ModelMapper modelMapper;

    @InjectMocks private TaskCommentService taskCommentService;

    private UUID taskId;
    private UUID userId;
    private UUID commentId;

    @BeforeEach
    void setUp() {
        taskId = UUID.randomUUID();
        userId = UUID.randomUUID();
        commentId = UUID.randomUUID();
    }

    @Test
    @DisplayName("createComment trims text and maps dto")
    void createComment_success() {
        Task task = new Task();
        task.setId(taskId);
        User user = new User();
        user.setId(userId);
        user.setUsername("john");

        TaskCommentCreateDTO dto = new TaskCommentCreateDTO();
        dto.setTaskId(taskId);
        dto.setComment("  hello world  ");

        TaskComment saved = TaskComment.builder().id(commentId).task(task).user(user).comment("hello world").build();
        TaskCommentDTO mapped = new TaskCommentDTO();

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(commentRepository.saveAndFlush(any(TaskComment.class))).thenReturn(saved);
        when(modelMapper.map(saved, TaskCommentDTO.class)).thenReturn(mapped);

        TaskCommentDTO result = taskCommentService.createComment(dto, userId);
        assertNotNull(result);
        verify(commentRepository).saveAndFlush(argThat(c -> "hello world".equals(c.getComment())));
    }

    @Test
    @DisplayName("createComment wraps task-not-found as runtime")
    void createComment_taskMissing_runtime() {
        TaskCommentCreateDTO dto = new TaskCommentCreateDTO();
        dto.setTaskId(taskId);
        dto.setComment("x");
        when(taskRepository.findById(taskId)).thenReturn(Optional.empty());
        RuntimeException ex = assertThrows(RuntimeException.class, () -> taskCommentService.createComment(dto, userId));
        assertTrue(ex.getMessage().contains("Failed to create comment"));
    }

    @Test
    @DisplayName("getCommentsByTask maps all rows")
    void getCommentsByTask_maps() {
        Task task = new Task();
        task.setId(taskId);
        User user = new User();
        user.setId(userId);
        user.setUsername("u");
        TaskComment c = TaskComment.builder().id(commentId).task(task).user(user).comment("c").build();
        TaskCommentDTO mapped = new TaskCommentDTO();

        when(commentRepository.findByTaskIdOrderByCreatedAtDesc(taskId)).thenReturn(List.of(c));
        when(modelMapper.map(c, TaskCommentDTO.class)).thenReturn(mapped);

        var result = taskCommentService.getCommentsByTask(taskId);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("deleteComment denies non-owner non-admin user")
    void deleteComment_deniedForNonAdmin() {
        User owner = new User();
        owner.setId(UUID.randomUUID());
        TaskComment comment = TaskComment.builder().id(commentId).user(owner).task(new Task()).comment("x").build();

        User requester = new User();
        requester.setId(userId);
        requester.setRole(UserRole.EMPLOYEE);

        when(commentRepository.findById(commentId)).thenReturn(Optional.of(comment));
        when(userRepository.findById(userId)).thenReturn(Optional.of(requester));

        assertThrows(IllegalStateException.class, () -> taskCommentService.deleteComment(commentId, userId));
        verify(commentRepository, never()).delete(any(TaskComment.class));
    }

    @Test
    @DisplayName("deleteComment allows admin override")
    void deleteComment_adminAllowed() {
        User owner = new User();
        owner.setId(UUID.randomUUID());
        TaskComment comment = TaskComment.builder().id(commentId).user(owner).task(new Task()).comment("x").build();

        User admin = new User();
        admin.setId(userId);
        admin.setRole(UserRole.ADMIN);

        when(commentRepository.findById(commentId)).thenReturn(Optional.of(comment));
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));

        taskCommentService.deleteComment(commentId, userId);
        verify(commentRepository).delete(comment);
    }

    @Test
    @DisplayName("deleteComment throws when comment missing")
    void deleteComment_missing_throws() {
        when(commentRepository.findById(commentId)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> taskCommentService.deleteComment(commentId, userId));
    }
}

