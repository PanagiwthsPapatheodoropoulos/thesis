package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.MessageType;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.model.dto.ChatMessageCreateDTO;
import com.thesis.smart_resource_planner.model.dto.ChatMessageDTO;
import com.thesis.smart_resource_planner.model.dto.ConversationDTO;
import com.thesis.smart_resource_planner.model.dto.TeamChatDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Employee;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.ChatMessageRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceDedicatedTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private WebSocketBroadcastService broadcastService;

    @InjectMocks
    private ChatService chatService;

    private UUID senderId;
    private UUID teamId;
    private User sender;
    private Company company;

    @BeforeEach
    void init() {
        senderId = UUID.randomUUID();
        teamId = UUID.randomUUID();
        company = new Company();
        company.setId(UUID.randomUUID());

        sender = new User();
        sender.setId(senderId);
        sender.setRole(UserRole.EMPLOYEE);
        sender.setCompany(company);
    }

    @Test
    @DisplayName("sendMessage rejects employee posting to foreign team")
    void sendMessage_teamUnauthorized() {
        Team foreignTeam = new Team();
        foreignTeam.setId(teamId);
        foreignTeam.setCompany(company);
        sender.setTeam(null);

        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("hello");
        dto.setTeamId(teamId);

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(foreignTeam));
        assertThrows(BadRequestException.class, () -> chatService.sendMessage(dto, senderId));
    }

    @Test
    @DisplayName("markAsRead returns immediately for already-read message")
    void markAsRead_alreadyRead() {
        ChatMessage m = ChatMessage.builder().id(UUID.randomUUID()).isRead(true).messageType(MessageType.TEXT).build();
        when(chatMessageRepository.findById(m.getId())).thenReturn(Optional.of(m));
        chatService.markAsRead(m.getId());
        verify(chatMessageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(broadcastService);
    }

    @Test
    @DisplayName("getUnreadCountPerContact groups unread by sender")
    void getUnreadCountPerContact_grouped() {
        UUID receiverId = UUID.randomUUID();
        User receiver = new User();
        receiver.setId(receiverId);
        receiver.setCompany(company);

        User s1 = new User();
        s1.setId(UUID.randomUUID());
        s1.setCompany(company);
        User s2 = new User();
        s2.setId(UUID.randomUUID());
        s2.setCompany(company);

        ChatMessage m1 = ChatMessage.builder().sender(s1).receiver(receiver).message("a").build();
        ChatMessage m2 = ChatMessage.builder().sender(s1).receiver(receiver).message("b").build();
        ChatMessage m3 = ChatMessage.builder().sender(s2).receiver(receiver).message("c").build();

        when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(chatMessageRepository.findUnreadByReceiverIdAndCompanyId(receiverId, company.getId()))
                .thenReturn(List.of(m1, m2, m3));

        Map<UUID, Long> counts = chatService.getUnreadCountPerContact(receiverId);
        assertEquals(2L, counts.get(s1.getId()));
        assertEquals(1L, counts.get(s2.getId()));
    }

    @Test
    @DisplayName("sendMessage throws when neither receiver nor team is provided")
    void sendMessage_missingReceiverAndTeam_throws() {
        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("hello");
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        assertThrows(BadRequestException.class, () -> chatService.sendMessage(dto, senderId));
    }

    @Test
    @DisplayName("sendMessage direct message broadcasts to sender and receiver")
    void sendMessage_direct_broadcasts() {
        UUID receiverId = UUID.randomUUID();
        User receiver = new User();
        receiver.setId(receiverId);
        receiver.setUsername("receiver");
        receiver.setCompany(company);
        sender.setUsername("sender");

        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("hi");
        dto.setReceiverId(receiverId);

        ChatMessage saved = ChatMessage.builder()
                .id(UUID.randomUUID())
                .sender(sender)
                .receiver(receiver)
                .message("hi")
                .messageType(MessageType.TEXT)
                .isRead(false)
                .build();
        ChatMessageDTO mapped = new ChatMessageDTO();

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));
        when(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).thenReturn(saved);
        when(modelMapper.map(saved, ChatMessageDTO.class)).thenReturn(mapped);
        when(employeeRepository.findByUserId(senderId)).thenReturn(Optional.empty());
        when(employeeRepository.findByUserId(receiverId)).thenReturn(Optional.empty());

        ChatMessageDTO result = chatService.sendMessage(dto, senderId);
        assertNotNull(result);
        verify(messagingTemplate, times(2)).convertAndSendToUser(anyString(), eq("/queue/messages"),
                any(ChatMessageDTO.class));
    }

    @Test
    @DisplayName("getAvailableContacts for employee includes managers and peers")
    void getAvailableContacts_employeePaths() {
        UUID employeeUserId = UUID.randomUUID();
        Team team = new Team();
        team.setId(UUID.randomUUID());

        User employeeUser = new User();
        employeeUser.setId(employeeUserId);
        employeeUser.setRole(UserRole.EMPLOYEE);
        employeeUser.setCompany(company);
        employeeUser.setTeam(team);

        User manager = new User();
        manager.setId(UUID.randomUUID());
        manager.setRole(UserRole.MANAGER);
        manager.setUsername("manager");
        manager.setCompany(company);

        User teammate = new User();
        teammate.setId(UUID.randomUUID());
        teammate.setRole(UserRole.EMPLOYEE);
        teammate.setUsername("teammate");
        teammate.setCompany(company);
        teammate.setTeam(team);

        Employee currentEmp = new Employee();
        currentEmp.setUser(employeeUser);
        currentEmp.setDepartment("Engineering");

        Employee deptEmp = new Employee();
        User deptPeer = new User();
        deptPeer.setId(UUID.randomUUID());
        deptPeer.setRole(UserRole.EMPLOYEE);
        deptPeer.setUsername("deptpeer");
        deptPeer.setCompany(company);
        deptEmp.setUser(deptPeer);

        when(userRepository.findById(employeeUserId)).thenReturn(Optional.of(employeeUser));
        when(userRepository.findByCompanyId(company.getId()))
                .thenReturn(List.of(employeeUser, manager, teammate, deptPeer));
        when(userRepository.findByTeamId(team.getId())).thenReturn(List.of(employeeUser, teammate));
        when(employeeRepository.findByUserId(employeeUserId)).thenReturn(Optional.of(currentEmp));
        when(employeeRepository.findByDepartmentAndCompanyId("Engineering", company.getId()))
                .thenReturn(List.of(deptEmp));
        when(userRepository.findById(manager.getId())).thenReturn(Optional.of(manager));
        when(userRepository.findById(teammate.getId())).thenReturn(Optional.of(teammate));
        when(userRepository.findById(deptPeer.getId())).thenReturn(Optional.of(deptPeer));
        when(modelMapper.map(any(User.class), eq(UserDTO.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            UserDTO d = new UserDTO();
            d.setId(u.getId());
            d.setUsername(u.getUsername());
            return d;
        });

        List<UserDTO> contacts = chatService.getAvailableContacts(employeeUserId);
        assertFalse(contacts.isEmpty());
        assertTrue(contacts.stream().anyMatch(c -> "manager".equals(c.getUsername())));
        assertTrue(contacts.stream().anyMatch(c -> "teammate".equals(c.getUsername())));
    }

    @Test
    @DisplayName("getUserTeamChats returns empty for user without team")
    void getUserTeamChats_employeeNoTeam_empty() {
        UUID userId = UUID.randomUUID();
        User employee = new User();
        employee.setId(userId);
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employee.setTeam(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(employee));

        assertTrue(chatService.getUserTeamChats(userId).isEmpty());
    }

    @Test
    @DisplayName("markAllAsRead updates unread messages and broadcasts")
    void markAllAsRead_updatesAndBroadcasts() {
        UUID userId = UUID.randomUUID();
        User receiver = new User();
        receiver.setId(userId);
        receiver.setCompany(company);
        ChatMessage m1 = ChatMessage.builder().id(UUID.randomUUID()).isRead(false).receiver(receiver).build();
        ChatMessage m2 = ChatMessage.builder().id(UUID.randomUUID()).isRead(false).receiver(receiver).build();

        when(chatMessageRepository.findUnreadByReceiverId(userId)).thenReturn(List.of(m1, m2));

        chatService.markAllAsRead(userId);
        assertTrue(m1.getIsRead());
        assertTrue(m2.getIsRead());
        verify(chatMessageRepository).saveAllAndFlush(anyList());
        verify(messagingTemplate).convertAndSend(eq("/user/" + userId + "/queue/chat-update"), anyMap());
    }

    @Test
    @DisplayName("getUnreadCount and getUnreadMessages use company-scoped queries")
    void unreadCountAndMessages_paths() {
        UUID userId = UUID.randomUUID();
        User receiver = new User();
        receiver.setId(userId);
        receiver.setCompany(company);
        User sender = new User();
        sender.setId(UUID.randomUUID());
        sender.setUsername("sender");
        sender.setCompany(company);
        ChatMessage msg = ChatMessage.builder().id(UUID.randomUUID()).sender(sender).receiver(receiver).build();
        ChatMessageDTO mapped = new ChatMessageDTO();

        when(userRepository.findById(userId)).thenReturn(Optional.of(receiver));
        when(chatMessageRepository.countUnreadByReceiverIdAndCompanyId(userId, company.getId())).thenReturn(3L);
        when(chatMessageRepository.findUnreadByReceiverIdAndCompanyId(userId, company.getId()))
                .thenReturn(List.of(msg));
        when(employeeRepository.findByUserIdIn(anySet())).thenReturn(List.of());
        when(modelMapper.map(msg, ChatMessageDTO.class)).thenReturn(mapped);

        assertEquals(3L, chatService.getUnreadCount(userId));
        assertEquals(1, chatService.getUnreadMessages(userId).size());
    }

    @Test
    @DisplayName("getConversations builds latest message and unread count")
    void getConversations_buildsSummary() {
        UUID userId = UUID.randomUUID();
        UUID partnerId = UUID.randomUUID();
        User me = new User();
        me.setId(userId);
        me.setUsername("me");
        me.setCompany(company);
        User partner = new User();
        partner.setId(partnerId);
        partner.setUsername("partner");
        partner.setRole(UserRole.EMPLOYEE);
        partner.setCompany(company);

        ChatMessage m1 = ChatMessage.builder()
                .id(UUID.randomUUID())
                .sender(partner)
                .receiver(me)
                .isRead(false)
                .message("hello")
                .createdAt(LocalDateTime.now().minusMinutes(5))
                .build();
        ChatMessage m2 = ChatMessage.builder()
                .id(UUID.randomUUID())
                .sender(me)
                .receiver(partner)
                .isRead(true)
                .message("reply")
                .createdAt(LocalDateTime.now())
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(me));
        when(chatMessageRepository.findAllUserMessagesByCompany(userId, company.getId())).thenReturn(List.of(m1, m2));
        when(userRepository.findById(partnerId)).thenReturn(Optional.of(partner));

        List<ConversationDTO> result = chatService.getConversations(userId);
        assertEquals(1, result.size());
        assertEquals(partnerId, result.get(0).getPartnerId());
        assertEquals("reply", result.get(0).getLastMessage());
        assertEquals(1, result.get(0).getUnreadCount());
    }

    @Test
    @DisplayName("getUserTeamChats for admin includes company teams")
    void getUserTeamChats_admin_seesAllTeams() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        admin.setRole(UserRole.ADMIN);
        admin.setCompany(company);

        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setName("Alpha");
        ChatMessage latest = ChatMessage.builder().id(UUID.randomUUID()).message("team msg")
                .createdAt(LocalDateTime.now()).build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(teamRepository.findByCompanyId(company.getId())).thenReturn(List.of(team));
        when(chatMessageRepository.findByTeamIdOrderByCreatedAtDesc(team.getId())).thenReturn(List.of(latest));
        when(userRepository.countByTeamId(team.getId())).thenReturn(2L);

        List<TeamChatDTO> chats = chatService.getUserTeamChats(adminId);
        assertEquals(1, chats.size());
        assertEquals("Alpha", chats.get(0).getTeamName());
        assertEquals("team msg", chats.get(0).getLastMessage());
    }

    @Test
    @DisplayName("getTeamMessages returns mapped messages for a team")
    void getTeamMessages_success() {
        Team team = new Team(); team.setId(teamId); team.setCompany(company);
        ChatMessage msg = ChatMessage.builder()
                .id(UUID.randomUUID())
                .message("hey team")
                .createdAt(LocalDateTime.now())
                .build();
                
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(chatMessageRepository.findByTeamIdAndCompanyIdOrderByCreatedAtDesc(teamId, company.getId())).thenReturn(List.of(msg));
        lenient().when(modelMapper.map(any(ChatMessage.class), eq(ChatMessageDTO.class))).thenReturn(new ChatMessageDTO());
        lenient().when(employeeRepository.findByUserIdIn(anySet())).thenReturn(List.of());
        
        List<ChatMessageDTO> result = chatService.getTeamMessages(teamId);
        assertEquals(1, result.size());
        verify(chatMessageRepository).findByTeamIdAndCompanyIdOrderByCreatedAtDesc(teamId, company.getId());
    }

    @Test
    @DisplayName("getDirectMessages returns mapped direct messages between two users")
    void getDirectMessages_success() {
        UUID otherId = UUID.randomUUID();
        User otherUser = new User(); otherUser.setId(otherId); otherUser.setCompany(company);
        
        ChatMessage msg = ChatMessage.builder()
                .id(UUID.randomUUID())
                .message("direct msg")
                .createdAt(LocalDateTime.now())
                .build();
                
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatMessageRepository.findDirectMessagesBetweenUsersAndCompany(senderId, otherId, company.getId())).thenReturn(List.of(msg));
        lenient().when(modelMapper.map(any(ChatMessage.class), eq(ChatMessageDTO.class))).thenReturn(new ChatMessageDTO());
        lenient().when(employeeRepository.findByUserIdIn(anySet())).thenReturn(List.of());
        
        List<ChatMessageDTO> result = chatService.getDirectMessages(senderId, otherId);
        assertEquals(1, result.size());
    }
}
